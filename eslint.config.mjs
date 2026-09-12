// Flat config for ESLint 9+. `npm run lint` checks this.
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "screenshots/**",
      "extension/icons/**",
      "node_modules/**",
    ],
  },
  js.configs.recommended,
  {
    // Extension background, content scripts, options, and popup pages.
    // Plain scripts (no modules) sharing globals across files: the background
    // page loads detectors.js via importScripts, and detectors.js carries a
    // Universal Module Definition shim so the Node tests can require it.
    // Catch bindings stay unnamed on purpose: every catch is a deliberate
    // nonfatal guard. A leading _ marks parameters kept for API symmetry.
    files: ["extension/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        chrome: "readonly",
        browser: "readonly",
        importScripts: "readonly",
        RalgrumDetectors: "readonly",
        module: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { caughtErrors: "none", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Manual preview pages load the built toast before their data script.
    files: ["tests/manual/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        RalgrumToast: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { caughtErrors: "none", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Tests, build script, and this config run on Node as ES modules.
    files: ["tests/**/*.test.mjs", "scripts/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
];
