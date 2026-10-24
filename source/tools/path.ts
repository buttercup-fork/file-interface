import { Layerr } from "layerr";
import { ERR_UNSAFE_NAME } from "../symbols.js";
import { Identifier } from "../types.js";

/**
 * Refuse a name that would leave the folder it is created in: empty, `.`,
 * `..`, or containing a slash, a backslash or a NUL character. Applied to
 * the names of new files and folders in the interfaces that build a path from
 * a parent and a name.
 * @param name The name to check
 */
export function assertSafeName(name: string): void {
    if (
        typeof name !== "string" ||
        name.length === 0 ||
        name === "." ||
        name === ".." ||
        /[\/\\\0]/.test(name)
    ) {
        throw new Layerr(
            { info: { code: ERR_UNSAFE_NAME } },
            `Unsafe file name: ${JSON.stringify(name)}`
        );
    }
}

/**
 * Join a remote (server-side) parent path and a name with a forward
 * slash. Remote paths are always POSIX-style: `join-path` falls back to
 * Node's `path.join`, which uses backslashes on Windows (e.g. in the
 * desktop app) and so created `\vaults\new.bcup` as one file at the
 * server root instead of `new.bcup` inside `/vaults`.
 * @param parentPath The parent path
 * @param name The name to append
 * @returns The joined path
 */
export function joinRemotePath(parentPath: Identifier, name: string): string {
    return `${String(parentPath).replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}`;
}
