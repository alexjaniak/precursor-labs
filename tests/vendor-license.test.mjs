import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const licenseUrl = new URL(
  "../licenses/elastic-stack-cards-LICENSE.txt",
  import.meta.url,
);

test("preserves the purchased Elastic Stack Cards license", () => {
  assert.ok(existsSync(licenseUrl), "purchased license must be committed");

  const licenseText = readFileSync(licenseUrl, "utf8");

  assert.match(licenseText, /^GSAP VAULT STANDARD LICENSE/);
  assert.match(
    licenseText,
    /Elastic Stack Cards \(effect, elastic-stack-cards\)/,
  );
  assert.match(
    licenseText,
    /Copyright \(c\) 2026 GSAP Vault\. All rights reserved\./,
  );
  assert.match(licenseText, /https:\/\/gsapvault\.com\/terms/);
});
