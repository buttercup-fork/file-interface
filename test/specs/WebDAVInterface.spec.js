import { expect } from "chai";
import sinon from "sinon";
import { WebDAVInterface } from "../../dist/interfaces/WebDAVInterface.js";

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
    });

    describe("putDirectory", function () {
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
