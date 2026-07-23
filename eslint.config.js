import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "examples/*.html"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The source deliberately uses patterns these rules flag: aliasing
      // `this` in tight tree-walk loops, a hand-written XML-name character
      // class, and intentional non-breaking-space literals in the serializer.
      // Relaxed here so `eslint .` stays clean without touching src/.
      "@typescript-eslint/no-this-alias": "off",
      "no-misleading-character-class": "off",
      "no-irregular-whitespace": "off",
      "prefer-const": "warn",
    },
  },
  {
    // TypeScript checks for undefined identifiers itself, so the core
    // `no-undef` rule is both redundant and wrong for .ts files (it does not
    // know about types or ambient/test globals). Disable it for TS only.
    files: ["**/*.ts"],
    rules: {
      "no-undef": "off",
    },
  },
  {
    // Node-based tooling (benchmarks, plain examples). The worker example also
    // uses worker/browser globals like `self` and `postMessage`.
    files: ["benchmarks/**/*.{js,mjs}", "examples/**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.worker,
      },
    },
  },
  {
    // Test files run in Node with Vitest globals enabled.
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Tests intentionally use bare getter expressions (e.g. `el.outerHTML;`)
      // to assert a property access does not throw.
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
);
