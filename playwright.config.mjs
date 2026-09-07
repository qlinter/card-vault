import { defineConfig } from "@playwright/test";

const port = 3360;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/ui",
  globalSetup: "./tests/ui/global-setup.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.003
    }
  },
  reporter: [
    ["line"],
    ["html", { open: "never" }]
  ],
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  use: {
    baseURL,
    browserName: "chromium",

    colorScheme: "light",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { viewport: { width: 1440, height: 1000 } }
    },
    {
      name: "mobile-chromium",
      testMatch: "**/visual.spec.mjs",
      grep: /share-preview|generated share preview fills/,
      use: { viewport: { width: 390, height: 844 } }
    }
  ]
});
