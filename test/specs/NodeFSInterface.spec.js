import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { expect } from "chai";
import { Layerr } from "layerr";
import pify from "pify";
import rimraf from "rimraf";
import fileExists from "file-exists";
import dirExists from "directory-exists";
import { NodeFSInterface } from "../../dist/interfaces/NodeFSInterface.js";
import { ERR_UNSAFE_NAME } from "../../dist/symbols.js";

const readFile = pify(fs.readFile);

async function rejection(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    return null;
}

// A copy of fs whose listed methods are replaced, to watch or fail one step
function fsWith(overrides) {
    return Object.assign({}, fs, overrides);
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const targetPath = path.resolve(__dirname, "../NodeFSInterface-resources");
const tmpFile = path.join(targetPath, "testfile.tmp");
const tmpDir = path.join(targetPath, "testdir");

describe("NodeFSInterface", function () {
    beforeEach(function () {
        this.interface = new NodeFSInterface({ fs });
    });

    describe("deleteFile", function () {
        beforeEach(function (done) {
            fs.writeFile(tmpFile, "test", () => {
                setTimeout(done, 250);
            });
        });

        it("deletes files", function () {
            return this.interface
                .deleteFile({ identifier: tmpFile })
                .then(() => fileExists(tmpFile))
                .then(exists => {
                    expect(exists).to.be.false;
                });
        });
    });

    describe("getDirectoryContents", function () {
        it("returns an array of items", function () {
            return this.interface
                .getDirectoryContents({ identifier: targetPath })
                .then(contents => {
                    expect(contents).to.be.an("array");
                    expect(contents).to.have.length.above(0);
                });
        });

        describe("returned items", function () {
            beforeEach(function () {
                return this.interface
                    .getDirectoryContents({ identifier: targetPath })
                    .then(contents => {
                        this.contents = contents;
                    });
            });

            it("correctly sets name & identifier properties", function () {
                const fileItem = this.contents.find(item => item.name === "rootfile.txt");
                expect(fileItem).to.have.property(
                    "identifier",
                    path.join(targetPath, "rootfile.txt")
                );
            });

            it("correctly identify directories", function () {
                const dirItem = this.contents.find(item => item.name === "somedir");
                expect(dirItem).to.have.property("type", "directory");
            });

            it("correctly identify files", function () {
                const fileItem = this.contents.find(item => item.name === "rootfile.txt");
                expect(fileItem).to.have.property("type", "file");
            });

            it("has correct file size", function () {
                const fileItem = this.contents.find(item => item.name === "rootfile.txt");
                expect(fileItem).to.have.property("size", 14);
            });

            it("has correct directory size (0)", function () {
                const dirItem = this.contents.find(item => item.name === "somedir");
                expect(dirItem).to.have.property("size", 0);
            });
        });
    });

    describe("getFileContents", function () {
        it("returns correct file contents", function () {
            const filename = path.join(targetPath, "rootfile.txt");
            return this.interface.getFileContents({ identifier: filename }).then(contents => {
                expect(contents.trim()).to.equal("root-file-txt");
            });
        });
    });

    describe("putDirectory", function () {
        afterEach(function () {
            return new Promise((resolve, reject) => {
                rimraf(tmpDir, err => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });
        });

        it("creates directories at the root", async function () {
            await this.interface.putDirectory(
                { identifier: targetPath },
                { identifier: null, name: "testdir" }
            );
            const exists = await dirExists(tmpDir);
            expect(exists).to.be.true;
        });
    });

    describe("putFileContents", function () {
        afterEach(function () {
            return new Promise((resolve, reject) => {
                rimraf(tmpFile, err => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });
        });

        it("writes correct contents", function () {
            return this.interface
                .putFileContents(
                    { identifier: targetPath },
                    { identifier: tmpFile, name: "testfile.tmp" },
                    "my\ndata"
                )
                .then(() => readFile(tmpFile, "utf8"))
                .then(contents => {
                    expect(contents).to.equal("my\ndata");
                });
        });

        it("returns correct identifier", function () {
            return this.interface
                .putFileContents(
                    { identifier: targetPath },
                    { identifier: tmpFile, name: "testfile.tmp" },
                    "my\ndata"
                )
                .then(identifier => {
                    expect(identifier).to.deep.equal({
                        identifier: tmpFile,
                        name: "testfile.tmp"
                    });
                });
        });

        it("creates a new file from a parent and a name", async function () {
            const result = await this.interface.putFileContents(
                { identifier: targetPath },
                { identifier: null, name: "testfile.tmp" },
                "new"
            );
            expect(result.identifier).to.equal(tmpFile);
            expect(await readFile(tmpFile, "utf8")).to.equal("new");
        });

        for (const name of ["../escaped.tmp", "a/b.tmp", "a\\b.tmp", "..", ".", ""]) {
            it(`refuses the name ${JSON.stringify(name)} and writes nothing`, async function () {
                const before = fs.readdirSync(path.dirname(targetPath)).sort();
                const err = await rejection(
                    this.interface.putFileContents(
                        { identifier: targetPath },
                        { identifier: null, name },
                        "x"
                    )
                );
                expect(Layerr.info(err)).to.include({ code: ERR_UNSAFE_NAME });
                expect(fs.readdirSync(path.dirname(targetPath)).sort()).to.deep.equal(before);
            });
        }

        it("writes through a temporary file renamed over the target", async function () {
            fs.writeFileSync(tmpFile, "old");
            const calls = [];
            const watching = fsWith({
                open: (file, flags, mode, cb) => {
                    calls.push(["open", path.basename(file), flags]);
                    fs.open(file, flags, mode, cb);
                },
                rename: (from, to, cb) => {
                    calls.push(["rename", path.basename(from), path.basename(to)]);
                    fs.rename(from, to, cb);
                }
            });
            await new NodeFSInterface({ fs: watching }).putFileContents(
                null,
                { identifier: tmpFile, name: "testfile.tmp" },
                "new"
            );
            expect(calls).to.have.length(2);
            expect(calls[0][0]).to.equal("open");
            expect(calls[0][1]).to.match(/^\.testfile\.tmp\..+\.tmp$/);
            expect(calls[0][2]).to.equal("wx");
            expect(calls[1]).to.deep.equal(["rename", calls[0][1], "testfile.tmp"]);
            expect(await readFile(tmpFile, "utf8")).to.equal("new");
            expect(
                fs.readdirSync(targetPath).filter(f => f.endsWith(".tmp") && f !== "testfile.tmp")
            ).to.deep.equal([]);
        });

        it("keeps the old contents and removes the temporary file when the write fails", async function () {
            fs.writeFileSync(tmpFile, "old");
            const failing = fsWith({
                rename: (from, to, cb) => cb(Object.assign(new Error("disk"), { code: "EIO" }))
            });
            const err = await rejection(
                new NodeFSInterface({ fs: failing }).putFileContents(
                    null,
                    { identifier: tmpFile, name: "testfile.tmp" },
                    "new"
                )
            );
            expect(err).to.be.an("error");
            expect(await readFile(tmpFile, "utf8")).to.equal("old");
            expect(
                fs.readdirSync(targetPath).filter(f => f.endsWith(".tmp") && f !== "testfile.tmp")
            ).to.deep.equal([]);
        });

        it("writes in place when the folder refuses new files", async function () {
            fs.writeFileSync(tmpFile, "old");
            const refusing = fsWith({
                open: (file, flags, mode, cb) =>
                    cb(Object.assign(new Error("denied"), { code: "EACCES" }))
            });
            await new NodeFSInterface({ fs: refusing }).putFileContents(
                null,
                { identifier: tmpFile, name: "testfile.tmp" },
                "new"
            );
            expect(await readFile(tmpFile, "utf8")).to.equal("new");
        });
    });
});
