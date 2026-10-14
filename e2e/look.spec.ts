import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Quick visual check of single pages: LOOK=1 LOOK_PATHS="/,/login" npx playwright test e2e/look.spec.ts
test.skip(!process.env.LOOK, "set LOOK=1");

test("look", async ({ browser }) => {
  mkdirSync("docs/screens", { recursive: true });
  const paths = (process.env.LOOK_PATHS ?? "/").split(",");
  for (const [name, vp] of [
    ["desktop", { width: 1280, height: 860 }],
    ["phone", { width: 390, height: 844 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: name === "phone" ? 2 : 1 });
    const page = await ctx.newPage();
    for (const p of paths) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/screens/look-${name}${p.replace(/[^a-z0-9]+/gi, "-")}.png`, fullPage: true });
    }
    await ctx.close();
  }
});
