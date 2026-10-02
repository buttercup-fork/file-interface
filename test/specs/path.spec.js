import { expect } from "chai";
import { joinRemotePath } from "../../dist/tools/path.js";

describe("joinRemotePath", function () {
    it("joins onto the root", function () {
        expect(joinRemotePath("/", "vault.bcup")).to.equal("/vault.bcup");
    });

    it("joins with forward slashes on every platform", function () {
        expect(joinRemotePath("/vaults/work", "vault.bcup")).to.equal("/vaults/work/vault.bcup");
    });

    it("doesn't double up slashes", function () {
        expect(joinRemotePath("/vaults/", "/vault.bcup")).to.equal("/vaults/vault.bcup");
    });
});
