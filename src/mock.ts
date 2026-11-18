// MintGuard — mock analyzer.
//
// Used ONLY while no real Firebase project is connected (see
// firebaseConfig.ts). A small, transparent rule-based screen over the pasted
// mint URL and contract address. It cannot browse the live page or read the
// chain, and it says so in its own output. Every result it produces is
// labeled "Mock — no Firebase project connected" in the UI.
//
// This file is intentionally dependency-free and uses only erasable
// TypeScript (interfaces, type aliases, plain functions), so it can be
// smoke-tested directly with Node: `npm run test:mock`.

export type Verdict = "SAFE" | "RISKY" | "SCAM";
export type Severity = "pass" | "info" | "warn" | "risk";
export type AnalysisSource = "MOCK" | "ON_DEVICE" | "IN_CLOUD";

export interface CheckItem {
  label: string;
  severity: Severity;
  detail: string;
}

export interface AnalysisResult {
  verdict: Verdict;
  /** 0–100, how confident the analyzer is in the verdict. */
  confidence: number;
  checks: CheckItem[];
  summary: string;
  source: AnalysisSource;
  /** Short human-readable note about which engine produced the answer. */
  modelNote: string;
}

export interface MintInput {
  url: string;
  contract: string;
}

const MOCK_NOTE = "Mock analyzer — no Firebase project connected";

const URL_SHORTENERS = new Set([
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "is.gd",
  "cutt.ly",
  "shrtco.de",
  "rebrand.ly",
  "ow.ly",
  "buff.ly",
  "tiny.cc",
]);

const ABUSE_PRONE_TLDS = new Set([
  "top",
  "buzz",
  "click",
  "link",
  "zip",
  "mov",
  "sbs",
  "quest",
  "cam",
  "rest",
]);

const WELL_KNOWN_BRANDS = [
  "opensea",
  "blur",
  "magiceden",
  "binance",
  "coinbase",
  "uniswap",
  "metamask",
  "phantom",
  "rarible",
  "looksrare",
];

const URGENCY_WORDS = [
  "hurry",
  "limited",
  "last chance",
  "ends soon",
  "ending soon",
  "only few left",
  "act now",
  "claim now",
  "before it",
];

function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

function isIpHost(host: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || /^\[[0-9a-fA-F:]+\]$/.test(host);
}

function score(checks: CheckItem[]): { verdict: Verdict; confidence: number } {
  let risk = 0;
  let warn = 0;
  for (const c of checks) {
    if (c.severity === "risk") risk += 1;
    if (c.severity === "warn") warn += 1;
  }
  const score = risk * 3 + warn;
  if (risk >= 2 || score >= 6) return { verdict: "SCAM", confidence: 78 };
  if (risk >= 1 || score >= 3) return { verdict: "SCAM", confidence: 64 };
  if (warn >= 2 || score >= 2) return { verdict: "RISKY", confidence: 58 };
  if (warn === 1) return { verdict: "RISKY", confidence: 52 };
  return { verdict: "SAFE", confidence: 55 };
}

function quickChecks(input: MintInput): CheckItem[] {
  const checks: CheckItem[] = [];
  const url = parseUrl(input.url);
  const contract = input.contract.trim();

  if (input.url.trim()) {
    if (!url) {
      checks.push({
        label: "Mint page URL",
        severity: "risk",
        detail: "This does not look like a valid URL, so nothing about the page can be trusted.",
      });
    } else {
      const host = url.hostname.toLowerCase();
      const tld = host.split(".").pop() ?? "";

      if (url.protocol === "http:") {
        checks.push({
          label: "Connection is not encrypted",
          severity: "warn",
          detail: "The mint page loads over plain HTTP. Legitimate mints use HTTPS.",
        });
      } else {
        checks.push({
          label: "Connection is encrypted",
          severity: "pass",
          detail: "The mint page loads over HTTPS.",
        });
      }

      if (isIpHost(host)) {
        checks.push({
          label: "Page hosted on a raw IP address",
          severity: "risk",
          detail: "Legitimate mints use a real domain. An IP address as the host is a classic drainer setup.",
        });
      }

      if (host.includes("xn--")) {
        checks.push({
          label: "Suspicious internationalized domain",
          severity: "risk",
          detail: "The domain uses punycode (xn--), a common trick to impersonate a real brand with look-alike characters.",
        });
      }

      if (URL_SHORTENERS.has(host)) {
        checks.push({
          label: "URL shortener",
          severity: "warn",
          detail: "The real destination is hidden behind a shortener. Legitimate mints link directly to their own domain.",
        });
      }

      if (ABUSE_PRONE_TLDS.has(tld)) {
        checks.push({
          label: "High-abuse domain ending",
          severity: "warn",
          detail: `The .${tld} ending is heavily abused by scam mints. It is not proof of a scam on its own, but it raises the bar for trust.`,
        });
      }

      const impersonated = WELL_KNOWN_BRANDS.find(
        (brand) => host.includes(brand) && !host.endsWith(`${brand}.io`) && !host.endsWith(`${brand}.com`) && host !== `${brand}.io` && host !== `${brand}.com`,
      );
      if (impersonated) {
        checks.push({
          label: "Possible brand impersonation",
          severity: "risk",
          detail: `The domain mentions "${impersonated}" but is not that brand's official domain. Scam mints copy trusted names to look legitimate.`,
        });
      }

      const haystack = `${url.pathname} ${url.search} ${url.hash}`.toLowerCase();
      const urgencyHit = URGENCY_WORDS.find((w) => haystack.includes(w));
      if (urgencyHit) {
        checks.push({
          label: "Urgency language in the link",
          severity: "warn",
          detail: `The link contains urgency wording ("${urgencyHit}"). Scam mints pressure visitors to act before thinking.`,
        });
      }
    }
  } else {
    checks.push({
      label: "Mint page URL",
      severity: "info",
      detail: "No mint page URL was provided, so the page itself could not be screened.",
    });
  }

  if (contract) {
    if (/^0x[0-9a-fA-F]{40}$/.test(contract)) {
      checks.push({
        label: "Contract address format",
        severity: "pass",
        detail: "The address is a well-formed EVM address. In mock mode its on-chain verification status cannot be checked.",
      });
    } else {
      checks.push({
        label: "Contract address format",
        severity: "risk",
        detail: "This is not a valid EVM contract address (expected 0x followed by 40 hex characters).",
      });
    }
  } else {
    checks.push({
      label: "Contract address",
      severity: "info",
      detail: "No contract address was provided, so nothing on-chain could be checked.",
    });
  }

  return checks;
}

/** Stage 1 — fast rule-based screen, mirroring the on-device quick screen. */
export function analyzeMock(input: MintInput): AnalysisResult {
  const checks = quickChecks(input);
  const { verdict, confidence } = score(checks);
  const summary =
    verdict === "SAFE"
      ? "No red flags in the quick screen. This is a weak signal — the mock screen cannot read the live page or the chain, so verify the contract on a block explorer before minting."
      : verdict === "RISKY"
        ? "The quick screen found warning signs. Do not connect a wallet until the flagged items are explained by a source you trust."
        : "The quick screen found strong scam indicators. Do not connect a wallet or sign anything for this mint.";
  return { verdict, confidence, checks, summary, source: "MOCK", modelNote: MOCK_NOTE };
}

/** Stage 2 — deeper rule-based analysis, mirroring the cloud deep analysis. */
export function analyzeMockDeep(input: MintInput): AnalysisResult {
  const checks = quickChecks(input);
  const contract = input.contract.trim();

  checks.push({
    label: "Contract verification",
    severity: "info",
    detail: contract
      ? "Mock mode cannot query a block explorer. Paste the address into BscScan or Etherscan and confirm the source code is verified."
      : "No contract address was provided, so verification cannot be checked.",
  });
  checks.push({
    label: "Mint price",
    severity: "info",
    detail: "Mock mode cannot read the mint price from the page. A free mint that asks for an approval or a signature is not free.",
  });
  checks.push({
    label: "Wallet approvals requested",
    severity: "info",
    detail: "Mock mode cannot inspect what the page asks your wallet to approve. Never approve unlimited token spending for a mint.",
  });
  checks.push({
    label: "Known drainer patterns",
    severity: "info",
    detail: "Mock mode has no live drainer list. Treat any page that demands a signature just to view it as a drainer until proven otherwise.",
  });
  checks.push({
    label: "Social proof",
    severity: "info",
    detail: "Mock mode cannot check the project's social accounts. A real project has a public history; a fresh account with only mint posts is a warning sign.",
  });

  const { verdict, confidence } = score(checks);
  const summary =
    verdict === "SAFE"
      ? "Nothing in the supplied data looks malicious, but the mock deep analysis cannot verify the contract, the price, or the page behavior. Confirm all three independently before minting."
      : verdict === "RISKY"
        ? "Warning signs remain after the deeper pass. The items marked as needing manual verification are exactly the ones a scam would hide behind."
        : "Strong scam indicators. Do not connect a wallet, do not sign, and do not approve anything for this mint.";
  return { verdict, confidence, checks, summary, source: "MOCK", modelNote: MOCK_NOTE };
}
