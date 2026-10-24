import { expect } from "chai";
import { Layerr } from "layerr";
import { assertSafeName, joinRemotePath } from "../../dist/tools/path.js";
import { ERR_UNSAFE_NAME } from "../../dist/symbols.js";

describe("assertSafeName", function () {
    for (const name of ["vault.bcup", "café.bcup", "a b", ".hidden", "a..b", "...", "x.y."]) {
        it(`accepts ${JSON.stringify(name)}`, function () {
            expect(() => assertSafeName(name)).to.not.throw();
        });
    }

    for (const name of [
        "",
        ".",
        "..",
        "a/b",
        "/a",
        "a/",
        "a\\b",
        "..\\x",
        "../x",
        "a\0b",
        null,
        undefined,
        5
    ]) {
        it(`refuses ${JSON.stringify(name)}`, function () {
            let error = null;
            try {
                assertSafeName(name);
            } catch (err) {
                error = err;
            }
            expect(Layerr.info(error)).to.include({ code: ERR_UNSAFE_NAME });
        });
    }
});

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
