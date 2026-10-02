// `npm run check:trades` — compiles src/lib + trades.ts to plain CommonJS (no account, no server, no AI) and runs the check.
const Module = require("module"); const path = require("path");
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { if (req.startsWith("@/")) req = path.join(__dirname, "out", "src", req.slice(2)); return orig.call(this, req, ...rest); };
require("./out/scripts/trade-check/trades.js");
