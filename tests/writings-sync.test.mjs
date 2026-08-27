import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalizeSubstackUrl,
  compareCodePoints,
  mergeWritings,
  normalizeUtcDate,
  parseRssFeed,
  parseXArticles,
  renderWritingRows,
  replaceWritingsMarkerContent,
  stableJson,
} from "../scripts/lib/writings.ts";

const repoRoot = new URL("../", import.meta.url);

const makeWriting = (overrides = {}) => ({
  title: "A title",
  author: "An author",
  publishedAt: "2026-08-01",
  url: "https://example.substack.com/p/a-title",
  source: "substack",
  ...overrides,
});

test("normalizes valid timestamps to a UTC calendar date", () => {
  assert.equal(normalizeUtcDate("2026-08-21T23:30:00-02:00"), "2026-08-22");
  assert.equal(normalizeUtcDate("Fri, 21 Aug 2026 23:30:00 GMT"), "2026-08-21");
  assert.equal(normalizeUtcDate("not-a-date"), null);
});

test("rejects signed or extended years outside exact YYYY-MM-DD output", () => {
  assert.equal(normalizeUtcDate("+010000-01-01T00:00:00.000Z"), null);
});

test("canonicalizes safe Substack URLs", () => {
  assert.equal(
    canonicalizeSubstackUrl(
      "https://writer.substack.com/p/my-post/?utm_source=feed#section",
      "https://writer.substack.com/feed",
    ),
    "https://writer.substack.com/p/my-post",
  );
  assert.equal(
    canonicalizeSubstackUrl("https://writer.substack.com/?utm_source=feed", "https://writer.substack.com/feed"),
    "https://writer.substack.com/",
  );
});

test("rejects unsafe, invalid, credentialed, and cross-host Substack URLs", () => {
  const feedUrl = "https://writer.substack.com/feed";
  assert.equal(canonicalizeSubstackUrl("http://writer.substack.com/p/post", feedUrl), null);
  assert.equal(canonicalizeSubstackUrl("javascript:alert(1)", feedUrl), null);
  assert.equal(canonicalizeSubstackUrl("https://user:pass@writer.substack.com/p/post", feedUrl), null);
  assert.equal(canonicalizeSubstackUrl("https://other.substack.com/p/post", feedUrl), null);
  assert.equal(canonicalizeSubstackUrl("not a URL", feedUrl), null);
});

test("parses one RSS item with CDATA and XML entities", () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel><item>
      <title><![CDATA[GPU <Memory> & Markets]]></title>
      <link>https://writer.substack.com/p/gpu-memory?utm_source=feed&amp;ref=home</link>
      <pubDate>2026-08-21T23:30:00-02:00</pubDate>
    </item></channel></rss>`;

  assert.deepEqual(
    parseRssFeed(xml, {
      author: "Configured Author",
      feedUrl: "https://writer.substack.com/feed",
    }),
    [
      {
        title: "GPU <Memory> & Markets",
        author: "Configured Author",
        publishedAt: "2026-08-22",
        url: "https://writer.substack.com/p/gpu-memory",
        source: "substack",
      },
    ],
  );
});

test("parses multiple RSS items and skips invalid entries", () => {
  const xml = `<rss><channel>
    <item><title>First &amp; Best</title><link>https://writer.substack.com/p/first</link><pubDate>2026-08-20T08:00:00Z</pubDate></item>
    <item><title>Second</title><link>https://writer.substack.com/p/second/</link><dc:date>2026-08-19T08:00:00Z</dc:date></item>
    <item><title>Bad date</title><link>https://writer.substack.com/p/bad</link><pubDate>invalid</pubDate></item>
    <item><title>Bad host</title><link>https://other.substack.com/p/bad</link><pubDate>2026-08-18T08:00:00Z</pubDate></item>
  </channel></rss>`;

  assert.deepEqual(
    parseRssFeed(xml, { author: "Writer", feedUrl: "https://writer.substack.com/feed" }),
    [
      makeWriting({
        title: "First & Best",
        author: "Writer",
        publishedAt: "2026-08-20",
        url: "https://writer.substack.com/p/first",
      }),
      makeWriting({
        title: "Second",
        author: "Writer",
        publishedAt: "2026-08-19",
        url: "https://writer.substack.com/p/second",
      }),
    ],
  );
});

test("parses X Articles with the supported title variants and precedence", () => {
  const response = {
    data: [
      {
        id: "101",
        created_at: "2026-08-21T23:30:00-02:00",
        article: { title: "Article object title" },
        article_title: "Fallback title",
      },
      {
        id: "102",
        created_at: "2026-08-20T10:00:00Z",
        article: {},
        article_title: "String title",
      },
      {
        id: "103",
        created_at: "2026-08-19T10:00:00Z",
        article: {},
        article_title: { title: "Nested fallback title" },
      },
    ],
  };

  assert.deepEqual(parseXArticles(response, { username: "writer", author: "Writer" }), [
    makeWriting({
      title: "Article object title",
      author: "Writer",
      publishedAt: "2026-08-22",
      url: "https://x.com/writer/status/101",
      source: "x-article",
    }),
    makeWriting({
      title: "String title",
      author: "Writer",
      publishedAt: "2026-08-20",
      url: "https://x.com/writer/status/102",
      source: "x-article",
    }),
    makeWriting({
      title: "Nested fallback title",
      author: "Writer",
      publishedAt: "2026-08-19",
      url: "https://x.com/writer/status/103",
      source: "x-article",
    }),
  ]);
});

test("rejects normal X posts and every referenced-post type", () => {
  const response = {
    data: [
      { id: "normal", created_at: "2026-08-21T00:00:00Z", text: "Normal post" },
      { id: "null", created_at: "2026-08-21T00:00:00Z", article: null, article_title: "No" },
      { id: "blank", created_at: "2026-08-21T00:00:00Z", article: {}, article_title: "  " },
      { id: "no-date", article: { title: "No date" } },
      { created_at: "2026-08-21T00:00:00Z", article: { title: "No id" } },
      {
        id: "reply",
        created_at: "2026-08-21T00:00:00Z",
        article: { title: "Reply" },
        referenced_tweets: [{ type: "replied_to", id: "1" }],
      },
      {
        id: "repost",
        created_at: "2026-08-21T00:00:00Z",
        article: { title: "Repost" },
        referenced_tweets: [{ type: "retweeted", id: "1" }],
      },
      {
        id: "quote",
        created_at: "2026-08-21T00:00:00Z",
        article: { title: "Quote" },
        referenced_tweets: [{ type: "quoted", id: "1" }],
      },
    ],
  };

  assert.deepEqual(parseXArticles(response, { username: "writer", author: "Writer" }), []);
});

test("uses raw Unicode code point order", () => {
  assert.equal(compareCodePoints("\uE000", "😀"), -1);
  assert.equal(compareCodePoints("😀", "\uE000"), 1);
  assert.equal(compareCodePoints("same", "same"), 0);
});

test("merges fetched data without removing historical records", () => {
  const historical = [
    makeWriting({ title: "Historical only", url: "https://example.substack.com/p/historical" }),
    makeWriting({ title: "Old title", publishedAt: "2026-08-01" }),
  ];
  const fetched = [makeWriting({ title: "New title", publishedAt: "2026-08-02" })];

  assert.deepEqual(mergeWritings(historical, fetched), [
    makeWriting({ title: "New title", publishedAt: "2026-08-02" }),
    makeWriting({ title: "Historical only", url: "https://example.substack.com/p/historical" }),
  ]);
});

test("uses fetched status, then title and author to resolve date-tied duplicates", () => {
  const url = "https://example.substack.com/p/tie";
  const historical = [makeWriting({ title: "A historical", author: "A", url })];
  const fetched = [
    makeWriting({ title: "Zulu", author: "Z", url }),
    makeWriting({ title: "Alpha", author: "Z", url }),
    makeWriting({ title: "Alpha", author: "A", url }),
  ];

  assert.deepEqual(mergeWritings(historical, fetched), [makeWriting({ title: "Alpha", author: "A", url })]);
});

test("sorts by descending date, then title and URL in raw code point order", () => {
  const rows = [
    makeWriting({ title: "😀", url: "https://example.substack.com/p/emoji" }),
    makeWriting({ title: "\uE000", url: "https://example.substack.com/p/private" }),
    makeWriting({ title: "A", url: "https://example.substack.com/p/z" }),
    makeWriting({ title: "A", url: "https://example.substack.com/p/a" }),
    makeWriting({ title: "Older", publishedAt: "2026-07-31", url: "https://example.substack.com/p/older" }),
  ];

  assert.deepEqual(
    mergeWritings([], rows).map(({ title, url }) => [title, url]),
    [
      ["A", "https://example.substack.com/p/a"],
      ["A", "https://example.substack.com/p/z"],
      ["\uE000", "https://example.substack.com/p/private"],
      ["😀", "https://example.substack.com/p/emoji"],
      ["Older", "https://example.substack.com/p/older"],
    ],
  );
});

test("serializes stable, byte-identical JSON with a final newline", () => {
  const value = { z: 1, a: [{ b: true }] };
  const once = stableJson(value);
  const twice = stableJson(JSON.parse(once));
  assert.equal(once, twice);
  assert.equal(once, '{\n  "z": 1,\n  "a": [\n    {\n      "b": true\n    }\n  ]\n}\n');
});

test("renders terminal rows with escaped text and safe link attributes", () => {
  const rows = renderWritingRows([
    makeWriting({
      title: `A & <B> "quote" 'single'`,
      author: `A & <B> "quote" 'single'`,
      url: "https://example.substack.com/p/safe",
    }),
  ]);

  assert.equal(
    rows,
    `                <li>\n` +
      `                  <a href="https://example.substack.com/p/safe" rel="noreferrer" target="_blank">A &amp; &lt;B&gt; &quot;quote&quot; &#39;single&#39;</a>\n` +
      `                  <span class="terminal-writing-author">A &amp; &lt;B&gt; &quot;quote&quot; &#39;single&#39;</span>\n` +
      `                  <time datetime="2026-08-01">2026-08-01</time>\n` +
      `                </li>`,
  );
  assert.throws(
    () => renderWritingRows([makeWriting({ url: "http://example.substack.com/p/unsafe" })]),
    /https/i,
  );
});

test("replaces only content between one valid marker pair in the writings list", () => {
  const start = "<!-- WRITINGS:START -->";
  const end = "<!-- WRITINGS:END -->";
  const before = `<main>keep-before<ol class="terminal-writing-list" data-writing-list>\n  ${start}`;
  const after = `${end}\n</ol>keep-after</main>`;
  const html = `${before}OLD CONTENT${after}`;
  const records = [makeWriting()];
  const result = replaceWritingsMarkerContent(html, records);

  assert.equal(result.slice(0, before.length), before);
  assert.equal(result.slice(-after.length), after);
  assert.equal(
    result.slice(before.length, -after.length),
    `\n${renderWritingRows(records)}\n  `,
  );
});

test("rejects missing, duplicate, reversed, and out-of-list writing markers", () => {
  const start = "<!-- WRITINGS:START -->";
  const end = "<!-- WRITINGS:END -->";
  const validList = (content) => `<ol data-writing-list>${content}</ol>`;

  assert.throws(() => replaceWritingsMarkerContent(validList("none"), []), /marker/i);
  assert.throws(() => replaceWritingsMarkerContent(validList(`${start}${start}${end}`), []), /marker/i);
  assert.throws(() => replaceWritingsMarkerContent(validList(`${end}${start}`), []), /marker/i);
  assert.throws(() => replaceWritingsMarkerContent(`${start}${end}${validList("none")}`, []), /writing list/i);
});

test("the source config contains the exact four Substack and four X mappings", async () => {
  const config = JSON.parse(await readFile(new URL("config/writing-sources.json", repoRoot), "utf8"));
  assert.deepEqual(config, {
    substack: [
      { feedUrl: "https://dylanvu.substack.com/feed", author: "dylan vu" },
      { feedUrl: "https://handsdiff.substack.com/feed", author: "hands" },
      { feedUrl: "https://impermanentfoundation.substack.com/feed", author: "Jakub Janiak" },
      { feedUrl: "https://collectgarbage.substack.com/feed", author: "Alex Janiak" },
    ],
    x: [
      { username: "dylanduyvu", author: "dylan vu" },
      { username: "handsdiff", author: "hands" },
      { username: "oogway_defi", author: "Jakub Janiak" },
      { username: "0xjaniak", author: "Alex Janiak" },
    ],
  });
});

test("the initial X sync state is stable and empty", async () => {
  const text = await readFile(new URL("data/writing-sync-state.json", repoRoot), "utf8");
  assert.equal(text, '{\n  "xAccounts": {}\n}\n');
});

test("the canonical seed has exactly the current 30 visible writings", async () => {
  const data = JSON.parse(await readFile(new URL("data/writings.json", repoRoot), "utf8"));
  assert.equal(data.length, 30);
  for (const record of data) {
    assert.deepEqual(Object.keys(record), ["title", "author", "publishedAt", "url", "source"]);
    assert.match(record.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.source === "substack" || record.source === "x-article");
  }
  assert.deepEqual(data, mergeWritings([], data));

  const html = await readFile(new URL("index.html", repoRoot), "utf8");
  const list = html.match(/<ol class="terminal-writing-list" data-writing-list>([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(list, "the visible writings list must exist");
  const visible = [...list.matchAll(/<li>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<span class="terminal-writing-author">([\s\S]*?)<\/span>\s*<time datetime="([^"]+)">/g)].map(
    ([, url, title, author, publishedAt]) => ({
      title: decodeHtml(title.trim()),
      author: decodeHtml(author.trim()),
      publishedAt,
      url,
      source: url.startsWith("https://x.com/") ? "x-article" : "substack",
    }),
  );
  assert.deepEqual(data, mergeWritings([], visible));
});

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}
