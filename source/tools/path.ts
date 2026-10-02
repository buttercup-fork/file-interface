import { Identifier } from "../types.js";

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
