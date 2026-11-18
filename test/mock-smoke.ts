// MintGuard — smoke test for the mock analyzer.
// Run with: npm run test:mock   (Node 24 runs .ts directly via type stripping)
// No browser, no Firebase, no network needed.

import { analyzeMock, analyzeMockDeep } from "../src/mock.ts";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — expected ${String(expected)}, got ${String(actual)}`);
}

const legit = analyzeMock({
  url: "https://mint.agentproject.io",
  contract: "0x19f125dA1985033f102CA7746Cbd1F6f512CFACd",
});
check("legit-looking mint is SAFE", legit.verdict, "SAFE");
check("legit result is mock-sourced", legit.source, "MOCK");

const scamIp = analyzeMock({
  url: "http://192.168.0.12/claim-free-hurry",
  contract: "0x123",
});
check("IP host + bad contract is SCAM", scamIp.verdict, "SCAM");

const punycode = analyzeMock({
  url: "https://xn--opensea-xyz.com/mint",
  contract: "",
});
check("punycode impersonation is SCAM", punycode.verdict, "SCAM");

const shortener = analyzeMock({
  url: "https://bit.ly/3abcXYZ",
  contract: "",
});
check("URL shortener is RISKY", shortener.verdict, "RISKY");

const deep = analyzeMockDeep({
  url: "https://mint.agentproject.io",
  contract: "0x19f125dA1985033f102CA7746Cbd1F6f512CFACd",
});
check("deep analysis on legit input is SAFE", deep.verdict, "SAFE");
check("deep analysis adds manual-verification checks", deep.checks.length >= 7, true);
check("deep result is mock-sourced", deep.source, "MOCK");

const empty = analyzeMock({ url: "", contract: "" });
check("empty input still returns a result", empty.checks.length >= 2, true);

console.log(`\n${failures === 0 ? "All mock smoke tests passed." : `${failures} test(s) failed.`}`);
process.exitCode = failures === 0 ? 0 : 1;
