import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_X_PAGES,
  REQUEST_TIMEOUT_MS,
  formatSyncSummary,
  runWritingsSync,
} from "../scripts/sync-writings.mts";

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

const paths = {
  config: "config.json",
  writings: "writings.json",
  state: "state.json",
  html: "index.html",
};

const markedHtml = (rows = "OLD ROWS") =>
  `<main>keep-before<ol class="terminal-writing-list" data-writing-list>\n` +
  `  <!-- WRITINGS:START -->${rows}<!-- WRITINGS:END -->\n` +
  `</ol>keep-after</main>\n`;

const rss = ({ title = "Fetched article", date = "2026-08-24T10:00:00Z", path = "fetched" } = {}) =>
  `<rss><channel><item><title>${title}</title><link>https://one.substack.com/p/${path}</link><pubDate>${date}</pubDate></item></channel></rss>`;

const makeMemoryFs = (initial, options = {}) => {
  const files = new Map(Object.entries(initial));
  const operations = [];
  let copyCount = 0;
  let renameCount = 0;
  const mustFail = (configured, count) =>
    Array.isArray(configured) ? configured.includes(count) : configured === count;

  return {
    files,
    operations,
    async readFile(path) {
      operations.push(["read", path]);
      if (!files.has(path)) throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
      return files.get(path);
    },
    async writeFile(path, value) {
      operations.push(["write", path, value]);
      files.set(path, value);
    },
    async copyFile(from, to) {
      operations.push(["copy", from, to]);
      copyCount += 1;
      options.onCopy?.({ copyCount, files, from, to });
      if (mustFail(options.failCopyAt, copyCount)) throw new Error("copy failed");
      if (!files.has(from)) throw new Error(`missing source file: ${from}`);
      files.set(to, files.get(from));
    },
    async rename(from, to) {
      operations.push(["rename", from, to]);
      renameCount += 1;
      if (mustFail(options.failRenameAt, renameCount)) throw new Error("rename failed");
      if (!files.has(from)) throw new Error(`missing temp file: ${from}`);
      files.set(to, files.get(from));
      files.delete(from);
    },
    async unlink(path) {
      operations.push(["unlink", path]);
      files.delete(path);
    },
  };
};

const jsonResponse = (value, init = {}) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

const textResponse = (value, init = {}) => new Response(value, { status: 200, ...init });

const makeInputs = ({ config, writings = [makeWriting()], state = { xAccounts: {} }, html } = {}) => ({
  [paths.config]: stableJson(
    config ?? {
      substack: [{ feedUrl: "https://one.substack.com/feed", author: "Writer One" }],
      x: [],
    },
  ),
  [paths.writings]: stableJson(writings),
  [paths.state]: stableJson(state),
  [paths.html]: html ?? markedHtml(),
});

test("normalizes valid timestamps to a UTC calendar date", () => {
  assert.equal(normalizeUtcDate("2026-08-21"), "2026-08-21");
  assert.equal(normalizeUtcDate("2026-08-21T23:30:00Z"), "2026-08-21");
  assert.equal(normalizeUtcDate("2026-08-21T23:30:00-02:00"), "2026-08-22");
  assert.equal(normalizeUtcDate("Fri, 21 Aug 2026 23:30:00 GMT"), "2026-08-21");
  assert.equal(normalizeUtcDate("Fri, 21 Aug 2026 23:30:00 UTC"), "2026-08-21");
  assert.equal(normalizeUtcDate("Fri, 21 Aug 2026 23:30:00 -0200"), "2026-08-22");
  assert.equal(normalizeUtcDate("not-a-date"), null);
});

test("rejects signed or extended years outside exact YYYY-MM-DD output", () => {
  assert.equal(normalizeUtcDate("+010000-01-01T00:00:00.000Z"), null);
});

test("rejects timezone-free timestamps and impossible calendar dates", () => {
  assert.equal(normalizeUtcDate("2026-08-21T23:30:00"), null);
  assert.equal(normalizeUtcDate("2026-02-29"), null);
  assert.equal(normalizeUtcDate("2026-02-29T00:00:00Z"), null);
  assert.equal(normalizeUtcDate("2026-04-31T00:00:00+00:00"), null);
  assert.equal(normalizeUtcDate("Fri, 31 Apr 2026 00:00:00 GMT"), null);
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

test("accepts only an empty referenced_tweets array when the field is present", () => {
  const article = (id, referenced_tweets) => ({
    id,
    created_at: "2026-08-21T00:00:00Z",
    article: { title: `Article ${id}` },
    referenced_tweets,
  });
  const response = {
    data: [article("201", []), article("202", { type: "quoted", id: "1" }), article("203", "quoted")],
  };

  assert.deepEqual(parseXArticles(response, { username: "writer", author: "Writer" }), [
    makeWriting({
      title: "Article 201",
      author: "Writer",
      publishedAt: "2026-08-21",
      url: "https://x.com/writer/status/201",
      source: "x-article",
    }),
  ]);
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

test("the canonical archive retains the initial 30 writings and matches the visible list", async () => {
  const data = JSON.parse(await readFile(new URL("data/writings.json", repoRoot), "utf8"));
  assert.ok(data.length >= 30);
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

test("attempts every Substack source, retains failed history, and skips X without a token", async () => {
  const historical = [
    makeWriting({ title: "Failed feed history", url: "https://two.substack.com/p/history" }),
  ];
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [
          { feedUrl: "https://one.substack.com/feed", author: "Writer One" },
          { feedUrl: "https://two.substack.com/feed", author: "Writer Two" },
        ],
        x: [{ username: "writer", author: "Writer" }],
      },
      writings: historical,
      state: { xAccounts: { writer: { sinceId: "44" } } },
    }),
  );
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "https://one.substack.com/feed") return textResponse(rss());
    return textResponse("unavailable", { status: 503 });
  };

  const result = await runWritingsSync({
    fetchImpl,
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: {},
    paths,
    logger: { info() {}, error() {} },
  });

  assert.deepEqual(
    calls.map(({ url }) => url),
    ["https://one.substack.com/feed", "https://two.substack.com/feed"],
  );
  for (const { init } of calls) {
    assert.equal(init.headers.Accept, "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7");
    assert.equal(init.headers["Accept-Language"], "en-US,en;q=0.9");
    assert.match(init.headers["User-Agent"], /^Mozilla\/5\.0 .*PrecursorLabsWritingSync\/1\.0/);
  }
  assert.equal(result.substack.succeeded, 1);
  assert.deepEqual(result.substack.failed, ["https://two.substack.com/feed"]);
  assert.equal(result.x.status, "skipped");
  assert.equal(fs.files.get(paths.state), stableJson({ xAccounts: { writer: { sinceId: "44" } } }));
  const merged = JSON.parse(fs.files.get(paths.writings));
  assert.equal(merged.some(({ title }) => title === "Fetched article"), true);
  assert.equal(merged.some(({ title }) => title === "Failed feed history"), true);
  assert.match(fs.files.get(paths.html), /keep-before/);
  assert.match(fs.files.get(paths.html), /keep-after/);
  assert.match(fs.files.get(paths.html), /Fetched article/);
});

test("uses exact X requests, maps handles case-insensitively, paginates, and keeps BigInt-safe cursors", async () => {
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [{ feedUrl: "https://one.substack.com/feed", author: "Writer One" }],
        x: [
          { username: "Alpha", author: "Author Alpha" },
          { username: "beta", author: "Author Beta" },
          { username: "missing", author: "Missing" },
        ],
      },
      state: { xAccounts: { beta: { sinceId: "700" }, missing: { sinceId: "88" } } },
    }),
  );
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.hostname.endsWith("substack.com")) return textResponse("bad feed");
    if (url.pathname === "/2/users/by") {
      return jsonResponse({ data: [{ id: "11", username: "ALPHA" }, { id: "22", username: "Beta" }] });
    }
    if (url.pathname === "/2/users/11/tweets" && !url.searchParams.has("pagination_token")) {
      return jsonResponse({
        data: [
          { id: "9007199254740993", created_at: "2026-08-25T00:00:00Z", article: { title: "Alpha article" } },
          { id: "9007199254740994", created_at: "2026-08-25T00:00:00Z", text: "normal post" },
          { id: "9007199254740995", created_at: "2026-08-25T00:00:00Z", article: { title: "Quoted" }, referenced_tweets: [{ type: "quoted", id: "1" }] },
        ],
        meta: { newest_id: "9007199254740994", next_token: "page-two" },
      });
    }
    if (url.pathname === "/2/users/11/tweets") {
      return jsonResponse({
        data: [{ id: "9007199254740997", created_at: "2026-08-26T00:00:00Z", article: { title: "Newest article" } }],
        meta: { newest_id: "9007199254740997" },
      });
    }
    if (url.pathname === "/2/users/22/tweets") {
      return jsonResponse({ data: [], meta: { newest_id: "699" } });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await runWritingsSync({
    fetchImpl,
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: { X_API_BEARER_TOKEN: "secret-token" },
    paths,
    logger: { info() {}, error() {} },
  });

  const resolveCall = calls.find(({ url }) => url.pathname === "/2/users/by");
  assert.equal(
    resolveCall.url.toString(),
    "https://api.x.com/2/users/by?usernames=Alpha%2Cbeta%2Cmissing&user.fields=username",
  );
  assert.equal(resolveCall.init.headers.Authorization, "Bearer secret-token");

  const alphaCalls = calls.filter(({ url }) => url.pathname === "/2/users/11/tweets");
  assert.equal(alphaCalls.length, 2);
  assert.deepEqual(Object.fromEntries(alphaCalls[0].url.searchParams), {
    max_results: "100",
    exclude: "replies,retweets",
    "tweet.fields": "article,article_title,created_at,referenced_tweets",
    start_time: "2026-07-27T12:00:00.000Z",
  });
  assert.equal(alphaCalls[1].url.searchParams.get("pagination_token"), "page-two");
  assert.equal(alphaCalls[1].url.searchParams.get("start_time"), "2026-07-27T12:00:00.000Z");

  const betaCall = calls.find(({ url }) => url.pathname === "/2/users/22/tweets");
  assert.equal(betaCall.url.searchParams.get("since_id"), "700");
  assert.equal(betaCall.url.searchParams.has("start_time"), false);
  assert.equal(betaCall.init.headers.Authorization, "Bearer secret-token");

  assert.equal(result.x.status, "partial");
  assert.deepEqual(result.x.failed, ["missing"]);
  assert.deepEqual(JSON.parse(fs.files.get(paths.state)), {
    xAccounts: {
      Alpha: { sinceId: "9007199254740997" },
      beta: { sinceId: "700" },
      missing: { sinceId: "88" },
    },
  });
  const rows = JSON.parse(fs.files.get(paths.writings));
  assert.equal(rows.some(({ title }) => title === "Alpha article"), true);
  assert.equal(rows.some(({ title }) => title === "Newest article"), true);
  assert.equal(rows.some(({ title }) => title === "Quoted"), false);
  assert.equal(rows.some(({ title }) => title === "normal post"), false);
});

test("retains an account cursor when a later X page fails while another account succeeds", async () => {
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [],
        x: [
          { username: "broken", author: "Broken" },
          { username: "working", author: "Working" },
        ],
      },
      state: { xAccounts: { broken: { sinceId: "50" }, working: { sinceId: "60" } } },
    }),
  );
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/2/users/by") {
      return jsonResponse({ data: [{ id: "1", username: "broken" }, { id: "2", username: "working" }] });
    }
    if (url.pathname === "/2/users/1/tweets" && !url.searchParams.has("pagination_token")) {
      return jsonResponse({ data: [{ id: "100", created_at: "2026-08-25T00:00:00Z", article: { title: "Do not keep partial" } }], meta: { next_token: "next", newest_id: "100" } });
    }
    if (url.pathname === "/2/users/1/tweets") {
      return jsonResponse({ errors: [{ detail: "later page failed" }] });
    }
    return jsonResponse({ data: [{ id: "200", created_at: "2026-08-25T00:00:00Z", article: { title: "Keep complete" } }], meta: { newest_id: "200" } });
  };

  const result = await runWritingsSync({
    fetchImpl,
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: { X_API_BEARER_TOKEN: "token" },
    paths,
    logger: { info() {}, error() {} },
  });

  assert.equal(result.x.status, "partial");
  assert.deepEqual(result.x.failed, ["broken"]);
  assert.deepEqual(JSON.parse(fs.files.get(paths.state)), {
    xAccounts: { broken: { sinceId: "50" }, working: { sinceId: "200" } },
  });
  const rows = JSON.parse(fs.files.get(paths.writings));
  assert.equal(rows.some(({ title }) => title === "Do not keep partial"), false);
  assert.equal(rows.some(({ title }) => title === "Keep complete"), true);
});

test("rejects an error-only X resolver response", async () => {
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [{ feedUrl: "https://one.substack.com/feed", author: "Writer One" }],
        x: [{ username: "writer", author: "Writer" }],
      },
      state: { xAccounts: { writer: { sinceId: "44" } } },
    }),
  );
  let timelineCalls = 0;
  const result = await runWritingsSync({
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith("substack.com")) return textResponse(rss());
      if (url.pathname === "/2/users/by") {
        return jsonResponse({ errors: [{ detail: "resolver failed" }] });
      }
      timelineCalls += 1;
      return jsonResponse({ data: [], meta: {} });
    },
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: { X_API_BEARER_TOKEN: "token" },
    paths,
    logger: { info() {}, error() {} },
  });

  assert.equal(timelineCalls, 0);
  assert.equal(result.x.succeeded, 0);
  assert.deepEqual(result.x.failed, ["writer"]);
  assert.deepEqual(JSON.parse(fs.files.get(paths.state)), {
    xAccounts: { writer: { sinceId: "44" } },
  });
});

test("isolates one unresolved X handle when resolver data also contains valid users", async () => {
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [],
        x: [
          { username: "valid", author: "Valid Writer" },
          { username: "suspended", author: "Suspended Writer" },
        ],
      },
      state: { xAccounts: { valid: { sinceId: "10" }, suspended: { sinceId: "20" } } },
    }),
  );
  const errors = [];
  let timelineCalls = 0;
  const result = await runWritingsSync({
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/2/users/by") {
        return jsonResponse({
          data: [{ id: "1", username: "VALID" }],
          errors: [{ value: "suspended", detail: "private resolver response detail" }],
        });
      }
      timelineCalls += 1;
      assert.equal(url.pathname, "/2/users/1/tweets");
      return jsonResponse({
        data: [
          {
            id: "99",
            created_at: "2026-08-25T00:00:00Z",
            article: { title: "Valid account article" },
          },
        ],
        meta: { newest_id: "99" },
      });
    },
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: { X_API_BEARER_TOKEN: "token" },
    paths,
    logger: { info() {}, error(message) { errors.push(message); } },
  });

  assert.equal(timelineCalls, 1);
  assert.equal(result.x.status, "partial");
  assert.equal(result.x.succeeded, 1);
  assert.deepEqual(result.x.failed, ["suspended"]);
  assert.deepEqual(JSON.parse(fs.files.get(paths.state)), {
    xAccounts: { valid: { sinceId: "99" }, suspended: { sinceId: "20" } },
  });
  assert.equal(
    JSON.parse(fs.files.get(paths.writings)).some(({ title }) => title === "Valid account article"),
    true,
  );
  assert.match(errors.join("\n"), /X resolver.*unresolved handles: 1/);
  assert.doesNotMatch(errors.join("\n"), /private resolver response detail/);
});

test("rejects error-only and mixed-data X timeline responses without advancing cursors", async () => {
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [{ feedUrl: "https://one.substack.com/feed", author: "Writer One" }],
        x: [
          { username: "erroronly", author: "Error Only" },
          { username: "mixed", author: "Mixed" },
        ],
      },
      state: { xAccounts: { erroronly: { sinceId: "10" }, mixed: { sinceId: "20" } } },
    }),
  );
  const result = await runWritingsSync({
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith("substack.com")) return textResponse(rss());
      if (url.pathname === "/2/users/by") {
        return jsonResponse({
          data: [
            { id: "1", username: "erroronly" },
            { id: "2", username: "mixed" },
          ],
        });
      }
      if (url.pathname === "/2/users/1/tweets") {
        return jsonResponse({ errors: [{ detail: "timeline failed" }] });
      }
      return jsonResponse({
        data: [
          {
            id: "99",
            created_at: "2026-08-25T00:00:00Z",
            article: { title: "Do not retain mixed data" },
          },
        ],
        errors: [{ detail: "timeline partial" }],
        meta: { newest_id: "99" },
      });
    },
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: { X_API_BEARER_TOKEN: "token" },
    paths,
    logger: { info() {}, error() {} },
  });

  assert.equal(result.x.succeeded, 0);
  assert.deepEqual(result.x.failed, ["erroronly", "mixed"]);
  assert.deepEqual(JSON.parse(fs.files.get(paths.state)), {
    xAccounts: { erroronly: { sinceId: "10" }, mixed: { sinceId: "20" } },
  });
  assert.equal(
    JSON.parse(fs.files.get(paths.writings)).some(({ title }) => title === "Do not retain mixed data"),
    false,
  );
});

test("sets a 15-second request signal on Substack, X resolve, and every X page", async () => {
  assert.equal(REQUEST_TIMEOUT_MS, 15_000);
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [{ feedUrl: "https://one.substack.com/feed", author: "Writer One" }],
        x: [{ username: "writer", author: "Writer" }],
      },
    }),
  );
  const calls = [];
  await runWritingsSync({
    fetchImpl: async (input, init = {}) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      if (url.hostname.endsWith("substack.com")) return textResponse(rss());
      if (url.pathname === "/2/users/by") {
        return jsonResponse({ data: [{ id: "1", username: "writer" }] });
      }
      if (!url.searchParams.has("pagination_token")) {
        return jsonResponse({ data: [], meta: { next_token: "second" } });
      }
      return jsonResponse({ data: [], meta: {} });
    },
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: { X_API_BEARER_TOKEN: "token" },
    paths,
    logger: { info() {}, error() {} },
  });

  assert.equal(calls.length, 4);
  for (const { init } of calls) {
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.signal.aborted, false);
  }
});

test("captures one run start before network work for all first-run X accounts", async () => {
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [{ feedUrl: "https://one.substack.com/feed", author: "Writer One" }],
        x: [
          { username: "first", author: "First" },
          { username: "second", author: "Second" },
        ],
      },
    }),
  );
  let nowCalls = 0;
  let networkStarted = false;
  const startTimes = [];
  await runWritingsSync({
    fetchImpl: async (input) => {
      networkStarted = true;
      const url = new URL(String(input));
      if (url.hostname.endsWith("substack.com")) return textResponse(rss());
      if (url.pathname === "/2/users/by") {
        return jsonResponse({
          data: [{ id: "1", username: "first" }, { id: "2", username: "second" }],
        });
      }
      startTimes.push(url.searchParams.get("start_time"));
      return jsonResponse({ data: [], meta: {} });
    },
    now: () => {
      assert.equal(networkStarted, false);
      nowCalls += 1;
      return new Date("2026-08-26T12:00:00.000Z");
    },
    fs,
    env: { X_API_BEARER_TOKEN: "token" },
    paths,
    logger: { info() {}, error() {} },
  });

  assert.equal(nowCalls, 1);
  assert.deepEqual(startTimes, ["2026-07-27T12:00:00.000Z", "2026-07-27T12:00:00.000Z"]);
});

test("rejects repeated X page tokens and the maximum page overflow while other accounts continue", async () => {
  assert.equal(MAX_X_PAGES, 100);
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [],
        x: [
          { username: "repeated", author: "Repeated" },
          { username: "unbounded", author: "Unbounded" },
          { username: "healthy", author: "Healthy" },
        ],
      },
      state: {
        xAccounts: {
          repeated: { sinceId: "10" },
          unbounded: { sinceId: "20" },
          healthy: { sinceId: "30" },
        },
      },
    }),
  );
  let repeatedCalls = 0;
  let unboundedCalls = 0;
  const result = await runWritingsSync({
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/2/users/by") {
        return jsonResponse({
          data: [
            { id: "1", username: "repeated" },
            { id: "2", username: "unbounded" },
            { id: "3", username: "healthy" },
          ],
        });
      }
      if (url.pathname === "/2/users/1/tweets") {
        repeatedCalls += 1;
        return jsonResponse({ data: [], meta: { next_token: "same-token" } });
      }
      if (url.pathname === "/2/users/2/tweets") {
        unboundedCalls += 1;
        return jsonResponse({ data: [], meta: { next_token: `page-${unboundedCalls}` } });
      }
      return jsonResponse({ data: [], meta: { newest_id: "31" } });
    },
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: { X_API_BEARER_TOKEN: "token" },
    paths,
    logger: { info() {}, error() {} },
  });

  assert.equal(repeatedCalls, 2);
  assert.equal(unboundedCalls, MAX_X_PAGES);
  assert.equal(result.x.status, "partial");
  assert.deepEqual(result.x.failed, ["repeated", "unbounded"]);
  assert.deepEqual(JSON.parse(fs.files.get(paths.state)), {
    xAccounts: {
      repeated: { sinceId: "10" },
      unbounded: { sinceId: "20" },
      healthy: { sinceId: "31" },
    },
  });
});

test("logs safe source, status, and X rate-limit details without secret data", async () => {
  const errors = [];
  const fs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [
          { feedUrl: "https://one.substack.com/feed", author: "Writer One" },
          { feedUrl: "https://two.substack.com/feed", author: "Writer Two" },
        ],
        x: [{ username: "writer", author: "Writer" }],
      },
    }),
  );
  await runWritingsSync({
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.href === "https://one.substack.com/feed") return textResponse(rss());
      if (url.href === "https://two.substack.com/feed") {
        return textResponse("private-response-body", { status: 503 });
      }
      if (url.pathname === "/2/users/by") {
        return jsonResponse({ data: [{ id: "1", username: "writer" }] });
      }
      return textResponse("private-x-body", {
        status: 429,
        headers: { "x-rate-limit-reset": "1787760000" },
      });
    },
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: { X_API_BEARER_TOKEN: "private-token" },
    paths,
    logger: { info() {}, error(message) { errors.push(message); } },
  });

  const log = errors.join("\n");
  assert.match(log, /https:\/\/two\.substack\.com\/feed.*HTTP 503/);
  assert.match(log, /writer.*HTTP 429.*rate-limit-reset 1787760000/);
  assert.doesNotMatch(log, /private-token|private-response-body|private-x-body|Authorization|Bearer/);

  const resolverErrors = [];
  const resolverFs = makeMemoryFs(
    makeInputs({
      config: {
        substack: [{ feedUrl: "https://one.substack.com/feed", author: "Writer One" }],
        x: [{ username: "writer", author: "Writer" }],
      },
    }),
  );
  await runWritingsSync({
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith("substack.com")) return textResponse(rss());
      return textResponse("private-resolver-body", {
        status: 503,
        headers: { "x-rate-limit-reset": "1787760100" },
      });
    },
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs: resolverFs,
    env: { X_API_BEARER_TOKEN: "private-token" },
    paths,
    logger: { info() {}, error(message) { resolverErrors.push(message); } },
  });
  const resolverLog = resolverErrors.join("\n");
  assert.match(resolverLog, /writer.*HTTP 503.*rate-limit-reset 1787760100/);
  assert.doesNotMatch(resolverLog, /private-token|private-resolver-body|Authorization|Bearer/);
});

test("formats the CLI result with succeeded and failed counts", () => {
  assert.equal(
    formatSyncSummary({
      substack: { succeeded: 3, failed: ["one"] },
      x: { status: "partial", succeeded: 2, failed: ["a", "b"] },
      writingCount: 40,
      changed: true,
    }),
    "Writings sync complete: 40 records; Substack 3 succeeded, 1 failed; X 2 succeeded, 2 failed",
  );
});

test("is byte-idempotent for the same files and Substack responses", async () => {
  const fs = makeMemoryFs(makeInputs());
  const options = {
    fetchImpl: async () => textResponse(rss()),
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: {},
    paths,
    logger: { info() {}, error() {} },
  };

  await runWritingsSync(options);
  const first = [paths.writings, paths.state, paths.html].map((path) => fs.files.get(path));
  await runWritingsSync(options);
  const second = [paths.writings, paths.state, paths.html].map((path) => fs.files.get(path));
  assert.deepEqual(second, first);
});

test("does not write when all remotes fail or when inputs are invalid", async () => {
  for (const initial of [
    makeInputs({
      config: {
        substack: [{ feedUrl: "https://one.substack.com/feed", author: "Writer" }],
        x: [{ username: "writer", author: "Writer" }],
      },
    }),
    { ...makeInputs(), [paths.state]: '{"xAccounts":[]}' },
  ]) {
    const fs = makeMemoryFs(initial);
    const before = new Map(fs.files);
    await assert.rejects(
      runWritingsSync({
        fetchImpl: async () => textResponse("bad feed"),
        now: () => new Date("2026-08-26T12:00:00.000Z"),
        fs,
        env: {},
        paths,
        logger: { info() {}, error() {} },
      }),
      /(?:remote source|state)/i,
    );
    assert.deepEqual(fs.files, before);
    assert.equal(fs.operations.some(([operation]) => operation === "write"), false);
  }
});

test("keeps all targets readable while it copies same-directory backups", async () => {
  const initial = makeInputs();
  const originals = new Map(Object.entries(initial));
  let copiesObserved = 0;
  const fs = makeMemoryFs(initial, {
    onCopy({ files }) {
      copiesObserved += 1;
      for (const path of [paths.writings, paths.html, paths.state]) {
        assert.equal(files.get(path), originals.get(path));
      }
    },
  });
  await runWritingsSync({
    fetchImpl: async () => textResponse(rss()),
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: {},
    paths,
    logger: { info() {}, error() {} },
  });

  assert.equal(copiesObserved, 3);
  const copiedTargets = fs.operations
    .filter(([operation]) => operation === "copy")
    .map(([, from]) => from);
  assert.deepEqual(copiedTargets, [paths.writings, paths.html, paths.state]);
  assert.equal(
    [...fs.files.keys()].some((path) => path.includes(".tmp-") || path.includes(".backup-")),
    false,
  );
});

test("keeps every original target unchanged if a backup copy fails", async () => {
  const initial = makeInputs();
  const originals = new Map(Object.entries(initial));
  const fs = makeMemoryFs(initial, { failCopyAt: 2 });
  await assert.rejects(
    runWritingsSync({
      fetchImpl: async () => textResponse(rss()),
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      fs,
      env: {},
      paths,
      logger: { info() {}, error() {} },
    }),
    /copy failed/,
  );
  for (const path of [paths.writings, paths.html, paths.state]) {
    assert.equal(fs.files.get(path), originals.get(path));
  }
  assert.equal(
    [...fs.files.keys()].some((path) => path.includes(".tmp-") || path.includes(".backup-")),
    false,
  );
});

test("restores exact originals after the second or third output promotion fails", async () => {
  for (const failRenameAt of [2, 3]) {
    const initial = makeInputs();
    const originals = new Map(Object.entries(initial));
    const fs = makeMemoryFs(initial, { failRenameAt });
    await assert.rejects(
      runWritingsSync({
        fetchImpl: async () => textResponse(rss()),
        now: () => new Date("2026-08-26T12:00:00.000Z"),
        fs,
        env: {},
        paths,
        logger: { info() {}, error() {} },
      }),
      /rename failed/,
    );
    for (const path of [paths.writings, paths.html, paths.state]) {
      assert.equal(fs.files.get(path), originals.get(path), `target changed after rename ${failRenameAt}: ${path}`);
    }
    assert.equal(
      [...fs.files.keys()].some((path) => path.includes(".tmp-") || path.includes(".backup-")),
      false,
    );
  }
});

test("keeps an unrestored backup as the recovery copy when rollback fails", async () => {
  const initial = makeInputs();
  const originals = new Map(Object.entries(initial));
  const fs = makeMemoryFs(initial, { failRenameAt: [2, 3] });
  await assert.rejects(
    runWritingsSync({
      fetchImpl: async () => textResponse(rss()),
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      fs,
      env: {},
      paths,
      logger: { info() {}, error() {} },
    }),
    /rollback failed/i,
  );

  const backups = [...fs.files.entries()].filter(([path]) => path.includes(".backup-"));
  assert.equal(backups.length, 1);
  assert.equal(backups[0][1], originals.get(paths.writings));
  assert.equal([...fs.files.keys()].some((path) => path.includes(".tmp-")), false);
  assert.equal(fs.files.get(paths.html), originals.get(paths.html));
  assert.equal(fs.files.get(paths.state), originals.get(paths.state));
});

test("promotes writings and HTML before cursor state", async () => {
  const fs = makeMemoryFs(makeInputs());
  await runWritingsSync({
    fetchImpl: async () => textResponse(rss()),
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    fs,
    env: {},
    paths,
    logger: { info() {}, error() {} },
  });
  const promotedTargets = fs.operations
    .filter(([operation, from]) => operation === "rename" && from.includes(".tmp-"))
    .map(([, , to]) => to);
  assert.deepEqual(promotedTargets, [paths.writings, paths.html, paths.state]);
});

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}
