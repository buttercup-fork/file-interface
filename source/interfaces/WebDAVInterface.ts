import joinPath from "join-path";
import { FileSystemInterface } from "../FileSystemInterface.js";
import { FileIdentifier, FileItem, PathIdentifier, WebDAVInterfaceConfig } from "../types.js";

/**
 * Normalise a path to NFC (composed) Unicode form. iOS/APFS stores
 * filenames in NFD (decomposed) form on disk, so a path built from an
 * iOS-observed filename (e.g. one containing 'é') can diverge
 * byte-for-byte from the NFC form most WebDAV servers store/expect,
 * breaking lookups and uploads (buttercup/buttercup-mobile#90).
 * @param path The path to normalise
 * @returns The normalised path
 */
function normalisePath(path: string): string {
    return path.normalize("NFC");
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
        return this.webdavClient.deleteFile(normalisePath(fileIdentifier.identifier as string));
    }

    /**
     * Get remote directory contents
     * @param pathIdentifier The path identifier to get the
     *  contents of
     * @returns A promise that resolves with an array of file
     *  items
     */
    getDirectoryContents(pathIdentifier?: PathIdentifier): Promise<Array<FileItem>> {
        const pathItem = pathIdentifier ? normalisePath(pathIdentifier.identifier as string) : "/";
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
        return this.webdavClient.getFileContents(normalisePath(fileIdentifier.identifier as string), {
            format: "text"
        });
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
        const dirPath = normalisePath(
            (fileIdentifier.identifier
                ? fileIdentifier.identifier
                : parentPathIdentifier
                ? joinPath(parentPathIdentifier.identifier, fileIdentifier.name)
                : joinPath("/", fileIdentifier.name)) as string
        );
        await this.webdavClient.createDirectory(dirPath);
        return {
            identifier: dirPath,
            name: fileIdentifier.name
        };
    }

    /**
     * Write remote file contents
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
        const filename = normalisePath(
            (fileIdentifier.identifier
                ? fileIdentifier.identifier
                : joinPath(parentPathIdentifier.identifier, fileIdentifier.name)) as string
        );
        await this.webdavClient.putFileContents(filename, data);
        return {
            identifier: filename,
            name: fileIdentifier.name
        };
    }
}
