// node --test src/lib/site-advanced-names.test.mjs — every layout the picker offers has a plain name.
import test from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../", import.meta.url).pathname } });
const N = await jiti.import("./site-advanced-names.ts");
test("every section layout has a name, and no name is for a layout that does not exist", () => { assert.deepEqual(N.checkVariantNames(), []); });
