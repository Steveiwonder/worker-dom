import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for the browser-DOM comparison suite.
 *
 * These specs load the built ESM bundle from `dist/` inside a real browser and
 * compare a supported subset of worker-vdom's behavior against the browser's
 * native DOM. Run `npm run build` first so `dist/` exists.
 *
 * This environment ships Chromium pre-installed (PLAYWRIGHT_BROWSERS_PATH is
 * already exported), so DO NOT run `playwright install`. Playwright resolves
 * the bundled browser automatically from that path — no `channel` is set so it
 * uses the bundled Chromium rather than a system Chrome. If you ever run this
 * where the browser lives elsewhere, point PLAYWRIGHT_BROWSERS_PATH at it or
 * add `launchOptions.executablePath` below.
 */
// Allow overriding the Chromium binary in environments where the pre-installed
// browser revision differs from the one @playwright/test would download. Set
// PLAYWRIGHT_CHROMIUM_EXECUTABLE to a chrome binary, otherwise Playwright uses
// its bundled resolution from PLAYWRIGHT_BROWSERS_PATH.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
});
