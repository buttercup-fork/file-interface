import path from "path";
import { Layerr } from "layerr";
import { FileSystemInterface } from "../FileSystemInterface.js";
import { ERR_FILE_EXISTS } from "../symbols.js";
import { assertSafeName } from "../tools/path.js";
import { FileIdentifier, FileItem, NodeFSInterfaceConfig, PathIdentifier } from "../types.js";

// Errors that mean the folder or file refuses the temporary-file route
const ACCESS_ERRORS = ["EACCES", "EPERM", "EBUSY"];

let tempCounter = 0;

export class NodeFSInterface extends FileSystemInterface {
    fs: any;

    constructor(config: NodeFSInterfaceConfig) {
        super(config);
        this.fs = config.fs;
    }

    /**
     * Delete a local file
     * @param fileIdentifier The file identifier to delete
     * @returns A promise that resolves after deletion is complete
     */
    deleteFile(fileIdentifier: FileIdentifier): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.fs.unlink(fileIdentifier.identifier, (err?: Error) => {
                if (err) {
                    return reject(
                        new Layerr(err, `Failed to delete file: ${fileIdentifier.identifier}`)
                    );
                }
                resolve();
            });
        });
    }

    /**
     * Get local directory contents
     * @param pathIdentifier The path identifier to get the contents of
     * @returns An array of file items
     */
    getDirectoryContents(pathIdentifier?: PathIdentifier): Promise<Array<FileItem>> {
        const { identifier: dir = "/" } = pathIdentifier || {};
        const fetch = new Promise<Array<string>>((resolve, reject) => {
            this.fs.readdir(dir, (err: Error | null, filenames: Array<string>) => {
                if (err) {
                    return reject(new Layerr(err, `Error reading directory contents: ${dir}`));
                }
                resolve(filenames);
            });
        });
        return fetch.then(filenames =>
            this._filenamesToStats(dir as string, filenames).then(items =>
                items.map(item =>
                    Object.assign(item, {
                        parent: pathIdentifier
                    })
                )
            )
        );
    }

    /**
     * Get local file contents
     * @param pathIdentifier The target file path identifier
     * @returns The file contents
     */
    getFileContents(pathIdentifier: PathIdentifier): Promise<string> {
        const { identifier: filename } = pathIdentifier;
        return new Promise((resolve, reject) => {
            this.fs.readFile(filename, "utf8", (err, data) => {
                if (err) {
                    return reject(new Layerr(err, `Error reading file: ${filename}`));
                }
                resolve(data);
            });
        });
    }

    /**
     * @see FileSystemInterface#getSupportedFeatures
     */
    getSupportedFeatures() {
        return [...super.getSupportedFeatures(), "created", "modified"];
    }

    /**
     * Check if a path identifier matches the root
     * @param pathIdentifer The path identifier to check
     * @returns True if root, false otherwise
     */
    pathIdentifierIsRoot(pathIdentifer?: PathIdentifier): boolean {
        return !pathIdentifer || pathIdentifer?.identifier === "/";
    }

    /**
     * Create a new directory
     * @param parentPathIdentifier The parent path to create inside, or
     *  null to indicate the root
     * @param fileIdentifier The identifier to create
     * @returns The newly created directory identifier
     */
    async putDirectory(
        parentPathIdentifier: PathIdentifier | null,
        fileIdentifier: FileIdentifier
    ): Promise<FileIdentifier> {
        let dirPath: string;
        if (fileIdentifier.identifier) {
            dirPath = fileIdentifier.identifier as string;
        } else {
            assertSafeName(fileIdentifier.name);
            dirPath = path.join(
                String(parentPathIdentifier?.identifier ?? "/"),
                fileIdentifier.name
            );
        }
        await new Promise<void>((resolve, reject) => {
            this.fs.mkdir(dirPath, {}, (err?: Error) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
        return {
            identifier: dirPath,
            name: fileIdentifier.name
        };
    }

    /**
     * Write local file contents. The file is written to a temporary file next
     * to the target, flushed and renamed over it, so an interrupted write
     * never leaves the target cut off. A new file (no identifier) is refused
     * if one with that name exists.
     * @param parentPathIdentifier The parent path identifier
     * @param fileIdentifier The file identifier to write to
     * @param data File data
     * @returns A promise that resolves with the identifier of the written file
     */
    async putFileContents(
        parentPathIdentifier: PathIdentifier,
        fileIdentifier: FileIdentifier,
        data: string
    ): Promise<FileIdentifier> {
        let filename: string;
        if (fileIdentifier.identifier) {
            filename = fileIdentifier.identifier as string;
        } else {
            assertSafeName(fileIdentifier.name);
            filename = path.join(
                String(parentPathIdentifier?.identifier ?? path.sep),
                fileIdentifier.name
            );
            if (await this._exists(filename)) {
                throw new Layerr(
                    { info: { code: ERR_FILE_EXISTS } },
                    `A file with that name already exists: ${filename}`
                );
            }
        }
        try {
            await this._writeSafely(filename, data);
        } catch (err) {
            throw new Layerr(err, `Error writing file: ${filename}`);
        }
        return {
            identifier: filename,
            name: fileIdentifier.name
        };
    }

    protected _call<T = any>(method: string, ...args: Array<any>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.fs[method](...args, (err: Error | null, result?: T) => {
                if (err) return reject(err);
                resolve(result as T);
            });
        });
    }

    protected async _exists(filename: string): Promise<boolean> {
        try {
            await this._call("stat", filename);
            return true;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
            throw err;
        }
    }

    protected async _writeSafely(target: string, data: string): Promise<void> {
        let mode = 0o666;
        try {
            const stat = await this._call("stat", target);
            mode = stat.mode & 0o777;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
        const tempPath = path.join(
            path.dirname(target),
            `.${path.basename(target)}.${Date.now()}-${++tempCounter}.tmp`
        );
        try {
            const fd = await this._call<number>("open", tempPath, "wx", mode);
            try {
                await this._call("writeFile", fd, data);
                await this._call("fsync", fd);
            } finally {
                await this._call("close", fd);
            }
            await this._call("rename", tempPath, target);
        } catch (err) {
            await this._call("unlink", tempPath).catch(() => {});
            if (!ACCESS_ERRORS.includes((err as NodeJS.ErrnoException).code as string)) throw err;
            // The folder doesn't allow new files, or another program holds
            // the target open: write it in place, as before
            await this._call("writeFile", target, data);
        }
    }

    protected _filenamesToStats(dir: string, filenames: Array<string>): Promise<Array<FileItem>> {
        return Promise.all(filenames.map(filename => this._stat(dir, filename)));
    }

    protected _stat(dir: string, filename: string): Promise<FileItem> {
        const fullPath = path.join(dir, filename);
        return new Promise((resolve, reject) => {
            this.fs.stat(fullPath, (err, stat) => {
                if (err) {
                    return reject(new Layerr(err, `Failed getting file properties: ${filename}`));
                }
                const { ctime, mtime, size } = stat;
                const type = stat.isDirectory() ? "directory" : "file";
                const created = new Date(ctime).toUTCString();
                const modified = new Date(mtime).toUTCString();
                resolve({
                    identifier: fullPath,
                    name: filename,
                    type,
                    size: stat.isDirectory() ? 0 : size,
                    created,
                    modified
                });
            });
        });
    }
}
