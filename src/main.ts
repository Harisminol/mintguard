// MintGuard — app entry point: wires the checker form to the hybrid AI layer.
import "./style.css";
import { isLiveMode, runDeepAnalysis, runQuickScreen } from "./ai";
import { renderError, renderResult } from "./ui";
import type { MintInput } from "./mock";

function required<T extends HTMLElement>(el: T | null, name: string): T {
  if (!el) throw new Error(`MintGuard: required page element is missing (${name}).`);
  return el;
}

const form = required(
  document.querySelector<HTMLFormElement>("#check-form"),
  "#check-form",
);
const urlInput = required(
  document.querySelector<HTMLInputElement>("#mint-url"),
  "#mint-url",
);
const contractInput = required(
  document.querySelector<HTMLInputElement>("#contract"),
  "#contract",
);
const checkBtn = required(
  document.querySelector<HTMLButtonElement>("#check-btn"),
  "#check-btn",
);
const deepBtn = required(
  document.querySelector<HTMLButtonElement>("#deep-btn"),
  "#deep-btn",
);
const statusEl = required(
  document.querySelector<HTMLElement>("#status"),
  "#status",
);
const resultsEl = required(
  document.querySelector<HTMLElement>("#results"),
  "#results",
);
const modeBanner = required(
  document.querySelector<HTMLElement>("#mode-banner"),
  "#mode-banner",
);

let lastInput: MintInput | null = null;
let deepDone = false;

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function readInput(): MintInput {
  return { url: urlInput.value, contract: contractInput.value };
}

function setBusy(busy: boolean): void {
  checkBtn.disabled = busy;
  deepBtn.disabled = busy;
  checkBtn.textContent = busy ? "Checking…" : "Check mint";
}

// Show which mode the app is running in before any check happens.
if (isLiveMode()) {
  modeBanner.classList.add("mode-live");
  modeBanner.textContent =
    "Live mode — Firebase AI Logic is connected. Answers run on-device first and fall back to the cloud when needed.";
} else {
  modeBanner.classList.add("mode-mock");
  modeBanner.textContent =
    "Mock mode — no Firebase project connected yet. Results come from a local rule-based analyzer. Paste a real config in src/firebaseConfig.ts to enable live hybrid AI (see README.md).";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = readInput();
  if (!input.url.trim() && !input.contract.trim()) {
    setStatus("Paste a mint page URL or a contract address first.");
    urlInput.focus();
    return;
  }
  lastInput = input;
  deepDone = false;
  deepBtn.hidden = true;
  resultsEl.innerHTML = "";
  setBusy(true);
  setStatus("Running quick screen…");
  try {
    const result = await runQuickScreen(input);
    renderResult(resultsEl, result, "Stage 1 — Quick screen");
    setStatus(
      result.source === "ON_DEVICE"
        ? "Quick screen ran on-device. Want a deeper look? Run the cloud analysis below."
        : "Quick screen complete. Run the deep cloud analysis below for a fuller checklist.",
    );
    deepBtn.hidden = false;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    renderError(resultsEl, message);
    setStatus("");
  } finally {
    setBusy(false);
  }
});

deepBtn.addEventListener("click", async () => {
  if (!lastInput || deepDone) return;
  deepDone = true;
  deepBtn.hidden = true;
  setBusy(true);
  setStatus("Running deep cloud analysis…");
  try {
    const result = await runDeepAnalysis(lastInput);
    const stage = document.createElement("div");
    stage.className = "stage-2";
    resultsEl.appendChild(stage);
    renderResult(stage, result, "Stage 2 — Deep analysis");
    setStatus("Deep analysis complete.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stage = document.createElement("div");
    stage.className = "stage-2";
    resultsEl.appendChild(stage);
    renderError(stage, message);
    setStatus("");
  } finally {
    setBusy(false);
  }
});
