// MintGuard — live backend smoke test (no browser needed).
//
// NOTE (verified 19 Nov 2026): this script tests a DIRECT REST call to the
// Gemini Developer API (generativelanguage.googleapis.com) with the Firebase
// web API key. That call returns 403 PERMISSION_DENIED BY DESIGN — a Firebase
// web key is not allowlisted for the Gemini Developer API and cannot be
// (the console requires a separate service-account-bound auth key for it).
// The Firebase AI Logic SDK does NOT call that endpoint: it routes through
// the Firebase AI Logic API (firebasevertexai.googleapis.com), which the
// Firebase key IS allowlisted for. So a 403 here does NOT mean the live
// path is broken. Verify the live path in a real browser (hosted app, run
// a check, look for the IN_CLOUD badge). This script is kept as a
// documented negative control only.
// Usage: node test/live-smoke.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src", "firebaseConfig.ts"), "utf8");
const match = src.match(/apiKey:\s*"([^"]+)"/);
if (!match || match[1].startsWith("YOUR_")) {
  console.error("FAIL: no real apiKey in src/firebaseConfig.ts");
  process.exit(1);
}
const apiKey = match[1];
const projectMatch = src.match(/projectId:\s*"([^"]+)"/);
console.log("project:", projectMatch ? projectMatch[1] : "(unknown)");

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { parts: [{ text: "Reply with exactly: LIVE OK" }] },
      ],
      generationConfig: { maxOutputTokens: 16, temperature: 0 },
    }),
  },
);
console.log("HTTP:", res.status);
const body = await res.json();
if (!res.ok) {
  console.error("FAIL:", JSON.stringify(body).slice(0, 500));
  process.exit(1);
}
const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
console.log("model reply:", JSON.stringify(text));
console.log(text.includes("LIVE OK") ? "LIVE SMOKE TEST PASSED" : "LIVE SMOKE TEST: unexpected reply");
