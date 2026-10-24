import { expect } from "chai";
import sinon from "sinon";
import { Layerr } from "layerr";
import { DropboxInterface } from "../../dist/interfaces/DropboxInterface.js";
import { ERR_UNSAFE_NAME } from "../../dist/symbols.js";

async function rejection(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    return null;
}

describe("DropboxInterface", function () {
    beforeEach(function () {
        this.dropboxClient = {
            createDirectory: sinon.stub().returns(Promise.resolve()),
            getDirectoryContents: sinon
                .stub()
                .returns(
                    Promise.resolve([{ name: "Existing.bcup", path: "/vaults/Existing.bcup" }])
                ),
            putFileContents: sinon.stub().returns(Promise.resolve())
        };
        this.interface = new DropboxInterface({ dropboxClient: this.dropboxClient });
    });

    describe("putFileContents", function () {
        it("writes to an existing identifier without listing the folder", async function () {
            await this.interface.putFileContents(
                { identifier: "/vaults" },
                { identifier: "/vaults/Existing.bcup", name: "Existing.bcup" },
                "data"
            );
            expect(this.dropboxClient.getDirectoryContents.called).to.be.false;
            expect(
                this.dropboxClient.putFileContents.calledWithExactly(
                    "/vaults/Existing.bcup",
                    "data"
                )
            ).to.be.true;
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
                expect(this.dropboxClient.getDirectoryContents.called).to.be.false;
                expect(this.dropboxClient.putFileContents.called).to.be.false;
            });
        }
    });

    describe("putDirectory", function () {
        it("creates a new directory under its parent", async function () {
            await this.interface.putDirectory(
                { identifier: "/vaults" },
                { identifier: null, name: "work" }
            );
            expect(this.dropboxClient.createDirectory.calledWithExactly("/vaults/work")).to.be.true;
        });

        for (const name of ["../x", "a/b", "a\\b", ".."]) {
            it(`refuses the new directory name ${JSON.stringify(name)}`, async function () {
                const err = await rejection(
                    this.interface.putDirectory(
                        { identifier: "/vaults" },
                        { identifier: null, name }
                    )
                );
                expect(Layerr.info(err)).to.include({ code: ERR_UNSAFE_NAME });
                expect(this.dropboxClient.createDirectory.called).to.be.false;
            });
        }
    });
});
