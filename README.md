# MintGuard

**Check a mint before you connect your wallet.**

MintGuard is a free web app that screens an NFT mint for scam indicators
before you connect a wallet. Paste a mint page URL and/or a contract
address and get a verdict — **SAFE / RISKY / SCAM** — with a checklist of
reasons. It is built with **Firebase AI Logic hybrid inference**: the quick
screen runs on-device on Gemini Nano when a local model is available and
falls back to Gemini in the cloud when it isn't. Every answer shows a badge
saying where it actually ran (`ON_DEVICE` or `IN_CLOUD`).

Entry for the **#BuildHybridAI 2026** hackathon
([Devpost](https://firebasehybridaihackathon.devpost.com/),
deadline 1 Dec 2026 05:00 WIB, $30,000 in cash prizes).

## How it works

1. **Stage 1 — Quick screen.** A short single-turn prompt. Runs with
   `InferenceMode.PREFER_ON_DEVICE`: on-device Gemini Nano first, cloud
   fallback (`gemini-3.5-flash-lite`) when Nano is unavailable.
2. **Stage 2 — Deep analysis.** A fuller structured prompt, run on demand
   with `InferenceMode.PREFER_IN_CLOUD`. Covers contract plausibility,
   URL trust, mint price, wallet approvals, drainer patterns, and social
   proof.
3. **Badges.** Every result shows `On-device · Gemini Nano`,
   `Cloud · Gemini`, or (until a Firebase project is connected)
   `Mock — no Firebase project connected`, using the SDK's
   `response.inferenceSource`.

The UI is in English: on-device Gemini Nano only supports
English/Japanese/Spanish/German/French — no Indonesian.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
npm run test:mock  # smoke-test the mock analyzer (no browser needed)
npm test           # mock tests + DOM smoke test of the built app (needs preview running for test:dom)
```

## Mock mode (fallback)

When no Firebase project is connected, the app runs end-to-end in
**mock mode**: a local rule-based analyzer (`src/mock.ts`) screens the
pasted URL and contract address (HTTPS, IP host, punycode, URL
shorteners, abuse-prone TLDs, brand impersonation, urgency wording,
contract address format). Every mock result is labeled in the UI. Mock
mode cannot browse the live page or read the chain — it says so in its
own output. The live project below is wired, so the deployed app does
not use mock mode.

## Connect a real Firebase project (free, no billing)

1. In the [Firebase console](https://console.firebase.google.com/), create
   a project on the **Spark (no-cost) plan. Do NOT link a billing
   account** — that upgrades the project to Blaze and flips all Gemini
   Developer API usage to pay-as-you-go.
2. Go to **AI Services > AI Logic > Get started** and choose
   **Gemini Developer API**. The guided setup enables the required APIs
   and allowlists the Firebase API key.
3. Register a **Web app** in the project and copy its config values into
   `src/firebaseConfig.ts` (replace every `YOUR_…` placeholder).
4. Enable **App Check** (required by AI Logic since Nov 2026) via the
   **Fraud Defense (reCAPTCHA Enterprise)** provider and paste the
   Enterprise site key into `RECAPTCHA_ENTERPRISE_SITE_KEY` in
   `src/firebaseConfig.ts`. Classic reCAPTCHA v3 is deprecated in the
   Firebase console (its secret-key field is disabled) — do not use it.
   - For local development, use an **App Check debug token** instead: the
     app sets `FIREBASE_APPCHECK_DEBUG_TOKEN = true` in dev mode, which
     prints a debug token in the browser console — register that token in
     the console under **App Check > Manage debug tokens**. Debug tokens
     are accepted by the hackathon.
5. Rebuild. The mode banner switches from "Mock mode" to "Live mode", and
   `src/ai.ts` genuinely imports and calls Firebase AI Logic at runtime.

## Live project (wired 19 Nov 2026)

- Firebase project: **MintGuard** (`mintguard-df373`), Spark (no-cost),
  no billing account, no Analytics. AI Logic with the Gemini Developer
  API enabled; web app "MintGuard Web" registered; App Check registered
  via Fraud Defense (reCAPTCHA Enterprise).
- The Firebase AI Logic SDK routes through the **Firebase AI Logic API**
  (`firebasevertexai.googleapis.com`), which the project's Firebase API
  key is allowlisted for. A direct REST call to the Gemini Developer API
  (`generativelanguage.googleapis.com`) with a Firebase web key returns
  403 by design — that is not a setup failure; verify the live path in a
  real browser instead (see `test/live-smoke.mjs` header).
- Deploy: `npm run build && firebase deploy --only hosting`
  (project `mintguard-df373`).

Notes:

- Text inference through the Gemini Developer API free tier works on
  Spark with no payment method. Preview and media-generating models
  (image/video) require Blaze — this app does not use them.
- Cloud model used: `gemini-3.5-flash-lite`. Do **not** use
  `gemini-2.5-flash`/`gemini-2.5-pro` — they shut down on 1 Dec 2026.
- Firestore/Auth are available on Spark but are **not wired in v1**;
  Cloud Functions and Cloud Storage need Blaze and are deliberately
  avoided.
- Never commit a secret (service-account key, reCAPTCHA secret key, or
  any credential) to this repository. The Firebase *web* config in
  `src/firebaseConfig.ts` is a public client identifier by design — it
  ships in the built JS bundle anyway — and its safety comes from the
  API-key allowlist and App Check enforcement, not from secrecy.
  `.gitignore` blocks `.env` files.

## Project structure

```
mintguard/
├── index.html            # App shell (header, hero, checker, how-it-works)
├── src/
│   ├── main.ts           # Form wiring, stage flow, mode banner
│   ├── ai.ts             # Firebase AI Logic hybrid calls (live path)
│   ├── mock.ts           # Rule-based mock analyzer (mock path)
│   ├── firebaseConfig.ts # Live Firebase web config + App Check key
│   ├── ui.ts             # Result rendering, verdict badges, SVG icons
│   └── style.css         # Product styling
├── test/
│   └── mock-smoke.ts     # Node smoke test for the mock analyzer
├── LICENSE               # Apache-2.0
└── README.md
```

## Still to do before submission

- [x] Firebase project created (Spark, no billing) and live config +
      App Check key wired (19 Nov 2026).
- [x] Live cloud path verified on the deployed app (Stage 1 SCAM 95%,
      Stage 2 SCAM 99%, `Cloud · Gemini` badge, 19 Nov 2026).
- [x] Pushed to a public GitHub repo with the Apache-2.0 license visible:
      https://github.com/Harisminol/mintguard
- [ ] Test the on-device path in desktop Chrome (Gemini Nano needs
      Chrome 138+, 16 GB RAM, 22 GB free disk; it cannot run on this VM
      or on a phone). Confirm the `On-device` badge appears.
- [ ] Record the demo video (≤ 3 minutes, English, on YouTube) showing
      the app working, including at least one on-device run if possible.
- [ ] Submit on Devpost before **1 Dec 2026 05:00 WIB**.

## Disclaimer

MintGuard is a screening aid, not a guarantee. A "SAFE" verdict does not
mean a mint is safe — scams evolve. Always verify a contract on a block
explorer and never approve unlimited token spending for a mint. MintGuard
never asks you to connect a wallet or sign anything.

## License

Apache-2.0 — see [LICENSE](LICENSE).
