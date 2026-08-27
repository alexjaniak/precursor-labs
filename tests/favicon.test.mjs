import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");

test("ships and references the complete Precursor favicon set", () => {
  const assets = [
    "favicon.svg",
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "apple-touch-icon.png",
    "android-chrome-192x192.png",
    "android-chrome-512x512.png",
    "site.webmanifest",
  ];

  for (const asset of assets) {
    assert.ok(existsSync(new URL(`public/${asset}`, root)), `missing ${asset}`);
  }

  assert.match(
    html,
    /<link rel="icon" href="\/favicon\.svg\?v=20260826" type="image\/svg\+xml" \/>/,
  );
  assert.match(html, /<link rel="alternate icon" href="\/favicon\.ico" \/>/);
  assert.doesNotMatch(html, /<link rel="icon"[^>]+href="\/favicon-(?:16|32)x(?:16|32)\.png"/);
  assert.match(
    html,
    /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" sizes="180x180" \/>/,
  );
  assert.match(html, /<link rel="manifest" href="\/site\.webmanifest" \/>/);
  assert.match(html, /https:\/\/precursorlabs\.org\/android-chrome-512x512\.png/);

  const svg = readFileSync(new URL("public/favicon.svg", root), "utf8");
  assert.equal(
    createHash("sha256").update(svg).digest("hex"),
    "553d3ab9d5e698db11f4230b48b9faea3aef11f0377292f52ea6b92bf82b980d",
  );

  const manifest = JSON.parse(
    readFileSync(new URL("public/site.webmanifest", root), "utf8"),
  );
  assert.equal(manifest.theme_color, "#FAFAFA");
  assert.equal(manifest.background_color, "#FAFAFA");
});
