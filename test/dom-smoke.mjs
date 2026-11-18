// MintGuard — DOM smoke test for the built app (mock mode).
// Run with: npm run test:dom   (requires `npm run preview` serving dist/ on :4173)
// Fetches the served page + production bundle and evaluates the bundle in
// jsdom (jsdom does not execute <script type="module">, but Vite's output
// is a self-contained IIFE with no imports, so eval is faithful). Fills the
// form, submits, and asserts the mock results render with their badge.
// No Firebase, no network beyond localhost.

import { JSDOM } from "jsdom";

const BASE = process.env.MINTGUARD_PREVIEW_URL ?? "http://localhost:4173/";

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — expected ${String(expected)}, got ${String(actual)}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const html = await (await fetch(BASE)).text();
const dom = new JSDOM(html, {
  url: BASE,
  runScripts: "dangerously",
  pretendToBeVisual: true,
});

const scriptSrc = [...dom.window.document.querySelectorAll("script")]
  .map((s) => s.getAttribute("src"))
  .find(Boolean);
if (!scriptSrc) throw new Error("No script tag found in served index.html");
const bundle = await (await fetch(new URL(scriptSrc, BASE))).text();
dom.window.eval(bundle);
await sleep(300);

const doc = dom.window.document;

check(
  "mode banner shows mock mode",
  doc.querySelector("#mode-banner")?.textContent?.includes("Mock mode") ?? false,
  true,
);

// 1. Submit a scam-looking mint.
doc.querySelector("#mint-url").value = "http://192.168.0.12/claim-free-hurry";
doc.querySelector("#contract").value = "0x123";
doc.querySelector("#check-form").dispatchEvent(
  new dom.window.Event("submit", { bubbles: true, cancelable: true }),
);
await sleep(500);

const results = doc.querySelector("#results");
check("stage 1 renders", results.querySelectorAll(".result").length, 1);
check(
  "stage 1 verdict is SCAM",
  results.querySelector(".verdict-title")?.textContent ?? "",
  "Likely a scam",
);
check(
  "stage 1 shows mock badge",
  results.querySelector(".badge-mock") !== null,
  true,
);
check("deep button appears", doc.querySelector("#deep-btn").hidden, false);

// 2. Run deep analysis.
doc.querySelector("#deep-btn").dispatchEvent(
  new dom.window.Event("click", { bubbles: true }),
);
await sleep(500);
check("stage 2 renders after deep click", results.querySelectorAll(".result").length, 2);
check(
  "stage 2 label present",
  results.textContent?.includes("Stage 2 — Deep analysis") ?? false,
  true,
);

// 3. Empty submit is rejected with a hint, not a crash.
doc.querySelector("#mint-url").value = "";
doc.querySelector("#contract").value = "";
doc.querySelector("#check-form").dispatchEvent(
  new dom.window.Event("submit", { bubbles: true, cancelable: true }),
);
await sleep(300);
check(
  "empty submit shows a hint",
  doc.querySelector("#status")?.textContent?.includes("Paste a mint page URL") ?? false,
  true,
);

dom.window.close();
console.log(`\n${failures === 0 ? "All DOM smoke tests passed." : `${failures} test(s) failed.`}`);
process.exitCode = failures === 0 ? 0 : 1;
