#!/usr/bin/env node
// postinstall: give node_modules/sharp a plain root-level index.js.
//
// Sharp 0.35+ ships as a dual package with no root index.js (package.json
// main = "./dist/index.cjs"). This Next.js 16 build's Turbopack treats sharp
// as a server "external" (it's on Next's own default external-packages list)
// and copies it to .next/node_modules/sharp-<hash>/ as a symlink back to
// node_modules/sharp — but Turbopack's RUNTIME loader for externals hardcodes
// "<folder>/index.js" instead of reading the package's own package.json
// main/exports field. Every production request that touched sharp (photo/
// logo/product uploads, banners) failed with:
//   "Cannot find package '.../sharp-<hash>/index.js'"
// even though the build itself always succeeded (that check runs through
// plain Node, not the broken runtime loader).
//
// Fix: make a real index.js exist at the package root so whichever loader
// asks for it gets sharp's real export. Runs after every npm install/ci,
// since node_modules/sharp gets wiped and reinstalled on every deploy.
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "node_modules", "sharp");
const target = path.join(dir, "index.js");
if (!fs.existsSync(dir)) { console.log("[patch-sharp] node_modules/sharp not installed, skipping"); process.exit(0); }
if (fs.existsSync(target)) { console.log("[patch-sharp] index.js already present, skipping"); process.exit(0); }
fs.writeFileSync(target, "module.exports = require('./dist/index.cjs');\n");
console.log("[patch-sharp] wrote node_modules/sharp/index.js");
