import { expect } from "chai";
import sinon from "sinon";
import { Layerr } from "layerr";
import { WebDAVInterface } from "../../dist/interfaces/WebDAVInterface.js";
import { ERR_FILE_EXISTS, ERR_UNSAFE_NAME } from "../../dist/symbols.js";

async function rejection(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    return null;
}

const NFD_NAME = "café.bcup";
const NFC_NAME = "café.bcup";

describe("WebDAVInterface", function () {
    beforeEach(function () {
        this.webdavClient = {
            createDirectory: sinon.stub().returns(Promise.resolve()),
            deleteFile: sinon.stub().returns(Promise.resolve()),
            getDirectoryContents: sinon.stub().returns(Promise.resolve([])),
            getFileContents: sinon.stub().returns(Promise.resolve("data")),
            putFileContents: sinon.stub().returns(Promise.resolve())
        };
        this.interface = new WebDAVInterface({ webdavClient: this.webdavClient });
    });

    describe("putFileContents", function () {
        it("normalises a new file name to NFC", async function () {
            const result = await this.interface.putFileContents(
                { identifier: "/vaults" },
                { identifier: null, name: NFD_NAME },
                "data"
            );
            expect(this.webdavClient.putFileContents.calledWith(`/vaults/${NFC_NAME}`)).to.be.true;
            expect(result.identifier).to.equal(`/vaults/${NFC_NAME}`);
        });

        it("writes to an existing identifier verbatim", async function () {
            await this.interface.putFileContents(
                { identifier: "/vaults" },
                { identifier: `/vaults/${NFD_NAME}`, name: NFD_NAME },
                "data"
            );
            expect(this.webdavClient.putFileContents.calledWith(`/vaults/${NFD_NAME}`)).to.be.true;
        });

        it("writes to an existing identifier without the overwrite option", async function () {
            await this.interface.putFileContents(
                { identifier: "/vaults" },
                { identifier: "/vaults/existing.bcup", name: "existing.bcup" },
                "data"
            );
            expect(this.webdavClient.putFileContents.firstCall.args[2]).to.be.undefined;
        });

        it("creates a new file with overwrite switched off", async function () {
            await this.interface.putFileContents(
                { identifier: "/vaults" },
                { identifier: null, name: "new.bcup" },
                "data"
            );
            expect(this.webdavClient.putFileContents.firstCall.args).to.deep.equal([
                "/vaults/new.bcup",
                "data",
                { overwrite: false }
            ]);
        });

        it("creates a new file at the root when the parent identifier is null", async function () {
            await this.interface.putFileContents(
                { identifier: null },
                { identifier: null, name: "new.bcup" },
                "data"
            );
            expect(this.webdavClient.putFileContents.firstCall.args[0]).to.equal("/new.bcup");
        });

        it("reports a 412 for a new file as an existing file", async function () {
            this.webdavClient.putFileContents.returns(
                Promise.reject(Object.assign(new Error("Precondition Failed"), { status: 412 }))
            );
            const err = await rejection(
                this.interface.putFileContents(
                    { identifier: "/vaults" },
                    { identifier: null, name: "new.bcup" },
                    "data"
                )
            );
            expect(Layerr.info(err)).to.include({ code: ERR_FILE_EXISTS });
        });

        it("passes other errors on unchanged", async function () {
            const failure = Object.assign(new Error("Server Error"), { status: 500 });
            this.webdavClient.putFileContents.returns(Promise.reject(failure));
            const err = await rejection(
                this.interface.putFileContents(
                    { identifier: "/vaults" },
                    { identifier: null, name: "new.bcup" },
                    "data"
                )
            );
            expect(err).to.equal(failure);
        });

        for (const name of ["../x.bcup", "a/b.bcup", "a\\b.bcup", "..", "."]) {
            it(`refuses the new file name ${JSON.stringify(name)}`, async function () {
                const err = await rejection(
                    this.interface.putFileContents(
                        { identifier: "/vaults" },
                        { identifier: null, name },
                        "data"
                    )
                );
                expect(Layerr.info(err)).to.include({ code: ERR_UNSAFE_NAME });
                expect(this.webdavClient.putFileContents.called).to.be.false;
            });
        }
    });

    describe("putDirectory", function () {
        for (const name of ["../x", "a/b", "a\\b", ".."]) {
            it(`refuses the new directory name ${JSON.stringify(name)}`, async function () {
                const err = await rejection(
                    this.interface.putDirectory(
                        { identifier: "/vaults" },
                        { identifier: null, name }
                    )
                );
                expect(Layerr.info(err)).to.include({ code: ERR_UNSAFE_NAME });
                expect(this.webdavClient.createDirectory.called).to.be.false;
            });
        }

        it("normalises a new directory name to NFC", async function () {
            await this.interface.putDirectory(null, { identifier: null, name: "résumé" });
            expect(this.webdavClient.createDirectory.calledWith("/résumé")).to.be.true;
        });
    });

    describe("getFileContents", function () {
        it("reads an existing identifier verbatim", async function () {
            await this.interface.getFileContents({ identifier: `/${NFD_NAME}` });
            expect(this.webdavClient.getFileContents.calledWith(`/${NFD_NAME}`)).to.be.true;
        });
    });

    describe("deleteFile", function () {
        it("deletes an existing identifier verbatim", async function () {
            await this.interface.deleteFile({ identifier: `/${NFD_NAME}` });
            expect(this.webdavClient.deleteFile.calledWithExactly(`/${NFD_NAME}`)).to.be.true;
        });
    });
});
