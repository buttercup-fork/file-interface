import { Layerr } from "layerr";
import { FileSystemInterface } from "../FileSystemInterface.js";
import { ERR_FILE_EXISTS } from "../symbols.js";
import { FileIdentifier, FileItem, PathIdentifier, WebDAVInterfaceConfig } from "../types.js";
import { assertSafeName, joinRemotePath } from "../tools/path.js";

/**
 * Normalise a new file or directory name to NFC (composed) Unicode form.
 * iOS/APFS hands out names in NFD (decomposed) form, so a name containing
 * 'é' can differ byte-for-byte from the NFC form most WebDAV servers
 * store (buttercup/buttercup-mobile#90). Only names we create are
 * normalised: identifiers returned by the server are sent back verbatim,
 * because byte-exact servers would otherwise miss an existing NFD file
 * (and a save would create a second copy beside it).
 * @param name The name to normalise
 * @returns The normalised name
 */
function normaliseName(name: string): string {
    return name.normalize("NFC");
}

export class WebDAVInterface extends FileSystemInterface {
    webdavClient: any;

    constructor(config: WebDAVInterfaceConfig) {
        super(config);
        this.webdavClient = config.webdavClient;
    }

    /**
     * Delete a remote file
     * @param fileIdentifier The file identifier to delete
     * @returns A promise that resolves once deletion has
     *  completed
     */
    deleteFile(fileIdentifier: FileIdentifier) {
        return this.webdavClient.deleteFile(fileIdentifier.identifier);
    }

    /**
     * Get remote directory contents
     * @param pathIdentifier The path identifier to get the
     *  contents of
     * @returns A promise that resolves with an array of file
     *  items
     */
    getDirectoryContents(pathIdentifier?: PathIdentifier): Promise<Array<FileItem>> {
        const pathItem = pathIdentifier ? pathIdentifier.identifier : "/";
        return this.webdavClient.getDirectoryContents(pathItem).then(contents =>
            contents.map(item => ({
                identifier: item.filename,
                name: item.basename,
                type: item.type,
                size: item.type === "directory" ? 0 : item.size,
                modified: new Date(item.lastmod).toUTCString(),
                parent: pathIdentifier
            }))
        );
    }

    /**
     * Get remote file contents
     * @param pathIdentifier The file to fetch the contents of
     * @returns A promise that resolves with the file contents
     */
    getFileContents(fileIdentifier: PathIdentifier): Promise<string> {
        return this.webdavClient.getFileContents(fileIdentifier.identifier, { format: "text" });
    }

    /**
     * @see FileSystemInterface#getSupportedFeatures
     */
    getSupportedFeatures(): Array<string> {
        return [...super.getSupportedFeatures(), "modified"];
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
            dirPath = joinRemotePath(
                parentPathIdentifier ? parentPathIdentifier.identifier : "/",
                normaliseName(fileIdentifier.name)
            );
        }
        await this.webdavClient.createDirectory(dirPath);
        return {
            identifier: dirPath,
            name: fileIdentifier.name
        };
    }

    /**
     * Write remote file contents. A new file (no identifier) is created with
     * `If-None-Match: *`, so the server refuses to replace one with that name.
     * @param parentPathIdentifier The parent path to write into
     * @param fileIdentifier The target file to write to
     * @param data File data
     * @returns The identifier of the file that was written
     */
    async putFileContents(
        parentPathIdentifier: PathIdentifier,
        fileIdentifier: FileIdentifier,
        data: string
    ): Promise<FileIdentifier> {
        let filename: string;
        const isNew = !fileIdentifier.identifier;
        if (isNew) {
            assertSafeName(fileIdentifier.name);
            filename = joinRemotePath(
                parentPathIdentifier?.identifier ?? "/",
                normaliseName(fileIdentifier.name)
            );
        } else {
            filename = fileIdentifier.identifier as string;
        }
        try {
            await this.webdavClient.putFileContents(
                filename,
                data,
                isNew ? { overwrite: false } : undefined
            );
        } catch (err) {
            // 412 Precondition Failed: the file appeared since it was listed
            if (isNew && (err as { status?: number })?.status === 412) {
                throw new Layerr(
                    { info: { code: ERR_FILE_EXISTS } },
                    `A file with that name already exists: ${filename}`
                );
            }
            throw err;
        }
        return {
            identifier: filename,
            name: fileIdentifier.name
        };
    }
}
