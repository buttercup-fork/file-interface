# File Interface changelog

## Unreleased (Codekunde fork)

 * **Breaking**: requires NodeJS 22 or newer (`engines`); CI runs on branch pushes only, on Node 22 and 24

 * **Tooling**:
   * A `prepare` script builds `dist/` on install, so the apps can install this fork straight from git (like the other forks)
   * Specs: the test fixture files are checked out byte for byte (`.gitattributes`). On a Windows checkout with `core.autocrlf` they got CRLF line endings, and `NodeFSInterface`'s "has correct file size" spec failed (15 bytes instead of 14)

 * **Security review fixes** (B-650, B-651, B-652, B-654):
   * Names of new files and directories are refused when empty, `.`, `..` or containing `/`, `\` or NUL (`ERR_UNSAFE_NAME`); `NodeFSInterface`, `WebDAVInterface` and `DropboxInterface` (B-650)
   * `NodeFSInterface` writes through a temporary file that is flushed and renamed over the target, instead of truncating the target first. It falls back to an in-place write if the folder refuses new files. A symbolic link at the target is replaced by the file rather than followed (B-651)
   * A new file (no identifier) no longer replaces an existing one: `ERR_FILE_EXISTS`. WebDAV sends `If-None-Match: *`; Dropbox (case-insensitive) and the local interface check first (B-652)
   * The `join-path` dependency (and `url-join`, `as-array`, `valid-url`) is gone; `NodeFSInterface` uses `path` (B-654)

 * **Bugfix**:
   * `WebDAVInterface` now normalises the names of new files and folders to NFC Unicode form, so a name with diacritics typed on iOS (NFD form) matches what most WebDAV servers store (buttercup/buttercup-mobile#90). Paths the server returned are sent back unchanged, so existing files with NFD names keep working.
   * `WebDAVInterface` and `DropboxInterface` always join remote paths with `/`. On Windows (desktop) they used `\`, so a new vault in a subfolder was created as one file named `\folder\name.bcup` at the server root
## v3.0.1
_2023-07-17_

 * React-Native entry in `package.json`

## v3.0.0
_2023-04-16_

 * ESM
 * Bundled types for Google Drive, Dropbox and WebDAV clients

## v2.0.0
_2021-11-26_

 * Removed registration functionality (manual instantiation only)
 * Root path identifier handling

## v1.1.0
_2021-11-22_

 * `putDirectory` method

## v1.0.1
_2021-11-16_

 * Export types

## v1.0.0
_2021-11-16_

 * Typescript

## v0.3.3
_2021-04-05_

 * **Bugfix**
   * Google Drive shared files would not show up

## v0.3.2
_2019-10-10_

 * **Bugfix**:
   * Dropbox client `putFileContents` wouldn't return connect identifier for `null` (creation)
   * WebDAV client `putFileContents` wouldn't return connect identifier for `null` (creation)

## v0.3.1
_2019-09-29_

 * **Bugfix**:
   * Dropbox client used incorrect value when putting file contents
   * WebDAV client used incorrect value when putting file contents

## v0.3.0
_2019-09-22_

 * `deleteFile` method

## v0.2.0
_2019-09-22_

 * **Bugfix**:
   * Date parsing would return invalid strings
 * Allow `fileIdentifier.identifier` to be `null` on all platforms to create _new_ files
 * `parent` property on `getDirectoryContents` results to refer to parent instance

## v0.1.1
_2019-09-22_

 * Make `getDirectoryContents` parameters optional for root contents

## v0.1.0
_2019-09-16_

 * Initial release
