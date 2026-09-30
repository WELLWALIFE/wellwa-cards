import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // This existing app intentionally hydrates browser-only preferences and
    // legacy async loaders in effects. They are verified in production builds.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    files: ["bridge/**/*.mjs"],
    // Baileys exports useMultiFileAuthState; despite its name it is not a React hook.
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "bridge/node_modules/**",
    "bridge/auth/**",
  ]),
]);

export default eslintConfig;
