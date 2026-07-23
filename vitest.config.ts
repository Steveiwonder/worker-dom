import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests live in tests/ and run in Node — the library has no browser deps.
    include: ["tests/**/*.{test,spec}.ts"],
    // Browser-DOM comparison specs live in tests/browser and run via Playwright.
    exclude: ["tests/browser/**", "node_modules/**", "dist/**"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
    },
  },
  // The source imports sibling modules with `.js` specifiers (NodeNext style).
  // Vite/Vitest resolve these back to the `.ts` sources automatically, so no
  // extra alias config is needed.
});
