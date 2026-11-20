// MintGuard — DOM smoke test for the built app.
// Run with: npm run test:dom   (requires `npm run preview` serving dist/ on :4173)
// Fetches the served page + production bundle and evaluates the bundle in
// jsdom (jsdom does not execute <script type="module">, but Vite's output
// is a self-contained IIFE with no imports, so eval is faithful).
//
// The test is mode-aware: in mock mode (no Firebase project configured) it
// submits a scam-looking mint and asserts the mock results render with
// their badge. In live mode (Firebase configured) the AI calls need a real
// browser with App Check, so it only asserts the shell — banner, example
// buttons, clear button, and the empty-submit hint. No Firebase, no network
// beyond localhost.

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
const banner = doc.querySelector("#mode-banner")?.textContent ?? "";
const isMock = banner.includes("Mock mode");

check(
  "mode banner shows a known mode",
  banner.includes("Mock mode") || banner.includes("Live mode"),
  true,
);

// New UI (both modes): example buttons fill the form, clear resets it.
doc.querySelector("#example-scam").dispatchEvent(
  new dom.window.Event("click", { bubbles: true }),
);
check(
  "scam example fills the URL field",
  doc.querySelector("#mint-url").value,
  "https://free-bored-ape-mint-claim.xyz",
);
check(
  "scam example fills the contract field",
  doc.querySelector("#contract").value,
  "0x1234567890abcdef1234567890abcdef12345678",
);
doc.querySelector("#example-legit").dispatchEvent(
  new dom.window.Event("click", { bubbles: true }),
);
check(
  "legit example fills the URL field",
  doc.querySelector("#mint-url").value,
  "https://boredapeyachtclub.com",
);
check(
  "legit example fills the contract field",
  doc.querySelector("#contract").value,
  "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
);
doc.querySelector("#clear-btn").dispatchEvent(
  new dom.window.Event("click", { bubbles: true }),
);
check("clear empties the URL field", doc.querySelector("#mint-url").value, "");
check("clear empties the contract field", doc.querySelector("#contract").value, "");

// Empty submit is rejected with a hint, not a crash.
doc.querySelector("#check-form").dispatchEvent(
  new dom.window.Event("submit", { bubbles: true, cancelable: true }),
);
await sleep(300);
check(
  "empty submit shows a hint",
  doc.querySelector("#status")?.textContent?.includes("Paste a mint page URL") ?? false,
  true,
);

if (isMock) {
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
} else {
  console.log("Live mode — skipping mock AI assertions (need a real browser + App Check).");
}

dom.window.close();
console.log(`\n${failures === 0 ? "All DOM smoke tests passed." : `${failures} test(s) failed.`}`);
process.exitCode = failures === 0 ? 0 : 1;
