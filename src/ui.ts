// MintGuard — rendering helpers (DOM only, no AI calls here).

import type { AnalysisResult, Severity, Verdict } from "./mock";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SEVERITY_ICON: Record<Severity, string> = {
  pass: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8.5 12.5l2.5 2.5 4.5-5" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 11v5" fill="none" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5L22 20H2z"/><path d="M12 10v4.5" fill="none" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.2" fill="currentColor" stroke="none"/></svg>',
  risk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
};

const VERDICT_COPY: Record<Verdict, { title: string; hint: string }> = {
  SAFE: {
    title: "Looks safe",
    hint: "No red flags found — but still verify the contract on a block explorer before minting.",
  },
  RISKY: {
    title: "Risky — be careful",
    hint: "Warning signs found. Do not connect a wallet until the flagged items are explained.",
  },
  SCAM: {
    title: "Likely a scam",
    hint: "Strong scam indicators. Do not connect a wallet or sign anything for this mint.",
  },
};

export function sourceBadge(result: AnalysisResult): string {
  if (result.source === "ON_DEVICE") {
    return `<span class="badge badge-device" title="This answer ran on-device on Gemini Nano.">On-device &middot; Gemini Nano</span>`;
  }
  if (result.source === "IN_CLOUD") {
    return `<span class="badge badge-cloud" title="This answer ran in the cloud on Gemini.">Cloud &middot; Gemini</span>`;
  }
  return `<span class="badge badge-mock" title="No Firebase project is connected yet, so this answer came from the local mock analyzer.">Mock &mdash; no Firebase project connected</span>`;
}

export function renderResult(
  container: HTMLElement,
  result: AnalysisResult,
  stageLabel: string,
): void {
  const copy = VERDICT_COPY[result.verdict];
  const verdictClass = result.verdict.toLowerCase();
  const checksHtml = result.checks
    .map(
      (c) => `
      <li class="check check-${c.severity}">
        <span class="check-icon">${SEVERITY_ICON[c.severity]}</span>
        <div class="check-body">
          <strong>${escapeHtml(c.label)}</strong>
          <span>${escapeHtml(c.detail)}</span>
        </div>
      </li>`,
    )
    .join("");
  container.innerHTML = `
    <article class="result result-${verdictClass}">
      <div class="result-head">
        <div>
          <p class="stage-label">${escapeHtml(stageLabel)}</p>
          <h3 class="verdict-title">${escapeHtml(copy.title)}</h3>
          <p class="verdict-hint">${escapeHtml(copy.hint)}</p>
        </div>
        <div class="result-meta">
          ${sourceBadge(result)}
          <span class="confidence">Confidence ${result.confidence}%</span>
          <span class="model-note">${escapeHtml(result.modelNote)}</span>
        </div>
      </div>
      <p class="summary">${escapeHtml(result.summary)}</p>
      <ul class="checks">${checksHtml}</ul>
    </article>`;
}

export function renderError(container: HTMLElement, message: string): void {
  container.innerHTML = `
    <div class="error" role="alert">
      <strong>Something went wrong.</strong>
      <span>${escapeHtml(message)}</span>
    </div>`;
}
