// MintGuard — Firebase AI Logic hybrid inference layer.
//
// When a real Firebase project is configured (see firebaseConfig.ts), this
// module genuinely imports and calls Firebase AI Logic at runtime:
//   - Stage 1 (quick screen): PREFER_ON_DEVICE — Gemini Nano in the browser
//     when a local model is available, cloud fallback otherwise.
//   - Stage 2 (deep analysis): PREFER_IN_CLOUD — a fuller analysis on
//     Gemini in the cloud, run only on demand.
// Every answer reports where it actually ran via response.inferenceSource
// (the SDK's "on_device" / "in_cloud" values, mapped to the ON_DEVICE /
// IN_CLOUD badges), and the UI shows that as a badge.
//
// When no Firebase project is configured, both stages fall back to the
// local mock analyzer (mock.ts) and every result is labeled as mock.
// Cloud models: gemini-3.5-flash-lite. Do NOT use gemini-2.5-flash/pro —
// they shut down on 1 Dec 2026, the hackathon deadline day.

import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
} from "firebase/ai";
import {
  firebaseConfig,
  isFirebaseConfigured,
  RECAPTCHA_ENTERPRISE_SITE_KEY,
} from "./firebaseConfig";
import {
  analyzeMock,
  analyzeMockDeep,
  type AnalysisResult,
  type MintInput,
  type Severity,
  type Verdict,
} from "./mock";

/** Cloud fallback model for both stages. */
const CLOUD_MODEL = "gemini-3.5-flash-lite";

const SYSTEM_INSTRUCTION =
  "You are MintGuard, a safety analyst for NFT mints. Answer in English, be strict, and never claim to have browsed a page or read a blockchain you cannot access.";

let firebaseApp: FirebaseApp | null = null;

/** True when a real Firebase project is configured and the live path is used. */
export function isLiveMode(): boolean {
  return isFirebaseConfigured();
}

function ensureFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Replace the placeholders in src/firebaseConfig.ts (see README.md).",
    );
  }
  firebaseApp = initializeApp(firebaseConfig);

  // App Check is required by Firebase AI Logic. In development, setting the
  // debug token flag makes the SDK use the debug provider; the token printed
  // in the browser console must be registered in the Firebase console under
  // App Check > Manage debug tokens. In production, the reCAPTCHA
  // Enterprise (Fraud Defense) provider below is used — classic
  // reCAPTCHA v3 is deprecated and cannot be registered in the console.
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }
  try {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // App Check setup failure is surfaced by the AI call itself; do not
    // block the rest of the app from loading.
    console.warn("[MintGuard] App Check could not be initialized:", err);
  }
  return firebaseApp;
}

function quickScreenPrompt(input: MintInput): string {
  return [
    "You are MintGuard, a fast on-device safety screener for NFT mints.",
    "A user is about to connect a wallet to a mint. Screen the supplied data for scam indicators.",
    "Mint page URL: " + (input.url.trim() || "(none provided)"),
    "Contract address: " + (input.contract.trim() || "(none provided)"),
    "Rules: answer in English. Be strict: an unknown is a warning, not a pass. Never claim you browsed the page or read the chain — you only have the data above.",
    "Reply with STRICT JSON only, no markdown fences, no extra text:",
    '{"verdict":"SAFE|RISKY|SCAM","confidence":0-100,"flags":[{"label":"short label","severity":"pass|info|warn|risk","detail":"one sentence"}],"summary":"one or two plain sentences"}',
    "Keep it short: at most 5 flags, summary under 280 characters.",
  ].join("\n");
}

function deepAnalysisPrompt(input: MintInput): string {
  return [
    "You are MintGuard, a deep safety analyst for NFT mints.",
    "A user is about to connect a wallet to a mint. Analyze the supplied data carefully and produce a verdict with a checklist.",
    "Mint page URL: " + (input.url.trim() || "(none provided)"),
    "Contract address: " + (input.contract.trim() || "(none provided)"),
    "Cover these checks explicitly, one flag each: contract address format and plausibility; mint page URL trust (domain, protocol, impersonation, urgency); mint price reasonableness; wallet approvals a mint like this typically requests and their danger; known drainer / wallet-drainer patterns; social proof signals.",
    "Rules: answer in English. Be strict: an unknown is a warning, not a pass. Never claim you browsed the page or read the chain — you only have the data above. Say what the user should verify manually.",
    "Consistency rule: if the supplied URL and contract match a widely-known legitimate project and are consistent with each other, treat that as positive evidence. Do not downgrade the verdict solely because you cannot browse the page or read the chain live — record that limitation as an info-severity flag, not a risk. Keep the strict posture for anything unknown, inconsistent, or impersonating a known brand.",
    "Reply with STRICT JSON only, no markdown fences, no extra text:",
    '{"verdict":"SAFE|RISKY|SCAM","confidence":0-100,"flags":[{"label":"short label","severity":"pass|info|warn|risk","detail":"one or two sentences"}],"summary":"two or three plain sentences","recommendations":["one concrete next step","another if needed"]}',
    "Keep it focused: at most 8 flags and 3 recommendations.",
  ].join("\n");
}

interface ParsedAiJson {
  verdict?: unknown;
  confidence?: unknown;
  flags?: unknown;
  summary?: unknown;
  recommendations?: unknown;
}

function parseAiJson(text: string): ParsedAiJson | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") return parsed as ParsedAiJson;
    return null;
  } catch {
    return null;
  }
}

function isSeverity(value: unknown): value is Severity {
  return (
    value === "pass" ||
    value === "info" ||
    value === "warn" ||
    value === "risk"
  );
}

function normalizeVerdict(value: unknown): Verdict {
  if (value === "SAFE" || value === "RISKY" || value === "SCAM") return value;
  return "RISKY";
}

function normalizeResult(
  parsed: ParsedAiJson | null,
  rawText: string,
  source: "ON_DEVICE" | "IN_CLOUD",
  modelNote: string,
): AnalysisResult {
  if (!parsed) {
    return {
      verdict: "RISKY",
      confidence: 40,
      checks: [
        {
          label: "Unstructured AI output",
          severity: "warn",
          detail:
            "The model did not return structured JSON, so its answer is shown as text instead of a checklist. Treat the verdict as uncertain.",
        },
      ],
      summary: rawText.trim().slice(0, 600) || "The model returned an empty answer.",
      source,
      modelNote,
    };
  }
  const checks = Array.isArray(parsed.flags)
    ? parsed.flags
        .filter(
          (f): f is Record<string, unknown> =>
            !!f && typeof f === "object",
        )
        .map((f) => ({
          label: String(f.label ?? "Check"),
          severity: isSeverity(f.severity) ? f.severity : "info",
          detail: String(f.detail ?? ""),
        }))
    : [];
  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations.map((r) => String(r)).filter(Boolean)
    : [];
  const summaryBase =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "No summary returned.";
  return {
    verdict: normalizeVerdict(parsed.verdict),
    confidence:
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
        : 50,
    checks:
      checks.length > 0
        ? checks
        : [
            {
              label: "No checks returned",
              severity: "info",
              detail: "The model returned a verdict without a checklist.",
            },
          ],
    summary:
      recommendations.length > 0
        ? `${summaryBase} Next steps: ${recommendations.join(" ")}`
        : summaryBase,
    source,
    modelNote,
  };
}

async function runReal(
  prompt: string,
  mode: InferenceMode,
  stage: "quick screen" | "deep analysis",
): Promise<AnalysisResult> {
  const ai = getAI(ensureFirebaseApp(), { backend: new GoogleAIBackend() });
  // HybridParams shape (firebase 13): `mode` at the top level, the cloud
  // model + system instruction under `inCloudParams`, and the on-device
  // system prompt under `onDeviceParams.createOptions.initialPrompts`.
  const model = getGenerativeModel(ai, {
    mode,
    inCloudParams: {
      model: CLOUD_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
    },
    onDeviceParams: {
      createOptions: {
        initialPrompts: [
          {
            role: "system",
            content: [{ type: "text", value: SYSTEM_INSTRUCTION }],
          },
        ],
      },
    },
  });
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  // inferenceSource is reported by the SDK as "on_device" or "in_cloud"
  // (see the InferenceSource enum). If it is ever absent, the request went
  // through the cloud path by definition of the fallback, so IN_CLOUD is
  // the honest default.
  const source =
    response.inferenceSource === InferenceSource.ON_DEVICE
      ? "ON_DEVICE"
      : "IN_CLOUD";
  const modelNote =
    source === "ON_DEVICE"
      ? "Gemini Nano (on-device)"
      : `Gemini ${CLOUD_MODEL} (cloud)`;
  const parsed = parseAiJson(text);
  const normalized = normalizeResult(parsed, text, source, modelNote);
  if (!parsed) {
    console.warn(`[MintGuard] ${stage} returned unstructured output.`);
  }
  return normalized;
}

/** Stage 1 — quick screen. On-device first, cloud fallback; mock when unconfigured. */
export async function runQuickScreen(input: MintInput): Promise<AnalysisResult> {
  if (!isFirebaseConfigured()) return analyzeMock(input);
  return runReal(quickScreenPrompt(input), InferenceMode.PREFER_ON_DEVICE, "quick screen");
}

/** Stage 2 — deep analysis in the cloud. Mock when unconfigured. */
export async function runDeepAnalysis(input: MintInput): Promise<AnalysisResult> {
  if (!isFirebaseConfigured()) return analyzeMockDeep(input);
  return runReal(deepAnalysisPrompt(input), InferenceMode.PREFER_IN_CLOUD, "deep analysis");
}
