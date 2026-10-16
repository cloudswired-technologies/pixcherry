import type { Browser, BrowserContext } from "@playwright/test";

// Every test context runs on this one PC, so they'd all share a phone signature
// and the join would say "this phone already joined". Give each context its own
// "phone" (a different CPU core count), unless a test deliberately reuses one.

let n = 0;

/** Pretends this context is the phone with the given id. */
export const asPhone = (ctx: BrowserContext, id: number) =>
  ctx.addInitScript((v) => {
    // The join matches screen + GPU/cores, so give each "phone" its own screen width and core count.
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { get: () => v, configurable: true });
    // Tests drive the album directly; the first-visit intro has its own test.
    try {
      localStorage.setItem("pc-skip-intro", "1");
    } catch {
      /* about:blank */
    }
    Object.defineProperty(Screen.prototype, "width", { get: () => 300 + (v % 997), configurable: true });
  }, id);

/** From now on, every new context of this browser is a different phone. */
export function distinctPhones(browser: Browser) {
  const b = browser as Browser & { __phones?: boolean };
  if (b.__phones) return;
  b.__phones = true;
  const make = browser.newContext.bind(browser);
  browser.newContext = async (opts) => {
    const ctx = await make(opts);
    await asPhone(ctx, 1000 + ++n); // unique within a run, so no two test phones look alike
    return ctx;
  };
}
