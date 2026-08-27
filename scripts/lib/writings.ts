import { XMLParser } from "fast-xml-parser";

export type WritingSource = "substack" | "x-article";

export interface WritingRecord {
  title: string;
  author: string;
  publishedAt: string;
  url: string;
  source: WritingSource;
}

export interface SubstackSource {
  feedUrl: string;
  author: string;
}

export interface XSource {
  username: string;
  author: string;
}

export const WRITINGS_START_MARKER = "<!-- WRITINGS:START -->";
export const WRITINGS_END_MARKER = "<!-- WRITINGS:END -->";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  processEntities: true,
  trimValues: true,
});

export function normalizeUtcDate(input: unknown): string | null {
  if (typeof input !== "string" || input.trim() === "") return null;

  const value = input.trim();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;

  const normalized = new Date(timestamp).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && normalized !== value) return null;
  return normalized;
}

export function canonicalizeSubstackUrl(input: unknown, feedUrl?: string): string | null {
  const url = parseSafeHttpsUrl(input);
  if (!url) return null;

  if (feedUrl !== undefined) {
    const feed = parseSafeHttpsUrl(feedUrl);
    if (!feed || feed.hostname !== url.hostname || feed.port !== url.port) return null;
  }

  url.hash = "";
  url.search = "";
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  }
  return url.toString();
}

export function parseRssFeed(xml: string, source: SubstackSource): WritingRecord[] {
  let parsed: unknown;
  try {
    parsed = xmlParser.parse(xml);
  } catch {
    return [];
  }

  const channel = asRecord(asRecord(parsed)?.rss)?.channel;
  const itemValue = asRecord(channel)?.item;
  const items = Array.isArray(itemValue) ? itemValue : itemValue === undefined ? [] : [itemValue];

  const records: WritingRecord[] = [];
  for (const itemValue of items) {
    const item = asRecord(itemValue);
    if (!item) continue;

    const title = cleanText(item.title);
    const url = canonicalizeSubstackUrl(cleanText(item.link), source.feedUrl);
    const publishedAt = normalizeUtcDate(item.pubDate ?? item["dc:date"] ?? item.date);
    if (!title || !url || !publishedAt || source.author.trim() === "") continue;

    records.push({
      title,
      author: source.author,
      publishedAt,
      url,
      source: "substack",
    });
  }
  return records;
}

export function parseXArticles(response: unknown, source: XSource): WritingRecord[] {
  const username = source.username.replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username) || source.author.trim() === "") return [];

  const data = asRecord(response)?.data;
  if (!Array.isArray(data)) return [];

  const records: WritingRecord[] = [];
  for (const value of data) {
    const post = asRecord(value);
    if (!post) continue;

    const article = asRecord(post.article);
    if (!article) continue;
    if (Array.isArray(post.referenced_tweets) && post.referenced_tweets.length > 0) continue;

    const id = cleanText(post.id);
    const publishedAt = normalizeUtcDate(post.created_at);
    const articleTitle = cleanText(article.title);
    const fallback = typeof post.article_title === "string" ? cleanText(post.article_title) : null;
    const nestedFallback = cleanText(asRecord(post.article_title)?.title);
    const title = articleTitle ?? fallback ?? nestedFallback;
    if (!id || !/^\d+$/.test(id) || !publishedAt || !title) continue;

    records.push({
      title,
      author: source.author,
      publishedAt,
      url: `https://x.com/${username}/status/${id}`,
      source: "x-article",
    });
  }
  return records;
}

export function compareCodePoints(left: string, right: string): -1 | 0 | 1 {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0) as number);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0) as number);
  const length = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] < rightPoints[index]) return -1;
    if (leftPoints[index] > rightPoints[index]) return 1;
  }
  if (leftPoints.length < rightPoints.length) return -1;
  if (leftPoints.length > rightPoints.length) return 1;
  return 0;
}

export function mergeWritings(
  historical: readonly WritingRecord[],
  fetched: readonly WritingRecord[],
): WritingRecord[] {
  const candidates = [
    ...historical.map((record) => ({ record: normalizeWritingRecord(record), fetched: false })),
    ...fetched.map((record) => ({ record: normalizeWritingRecord(record), fetched: true })),
  ];
  const winners = new Map<string, { record: WritingRecord; fetched: boolean }>();

  for (const candidate of candidates) {
    const current = winners.get(candidate.record.url);
    if (!current || compareDuplicateCandidates(candidate, current) < 0) {
      winners.set(candidate.record.url, candidate);
    }
  }

  return [...winners.values()]
    .map(({ record }) => record)
    .sort(compareWritingRecords);
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderWritingRows(records: readonly WritingRecord[]): string {
  return records
    .map((input) => {
      const record = normalizeWritingRecord(input);
      const href = escapeHtml(record.url);
      return [
        "                <li>",
        `                  <a href="${href}" rel="noreferrer" target="_blank">${escapeHtml(record.title)}</a>`,
        `                  <span class="terminal-writing-author">${escapeHtml(record.author)}</span>`,
        `                  <time datetime="${record.publishedAt}">${record.publishedAt}</time>`,
        "                </li>",
      ].join("\n");
    })
    .join("\n");
}

export function replaceWritingsMarkerContent(html: string, records: readonly WritingRecord[]): string {
  const startIndex = uniqueMarkerIndex(html, WRITINGS_START_MARKER);
  const endIndex = uniqueMarkerIndex(html, WRITINGS_END_MARKER);
  if (endIndex < startIndex) throw new Error("Writings markers are reversed");

  const listOpen = html.search(/<ol\b[^>]*\bdata-writing-list\b[^>]*>/);
  if (listOpen < 0) throw new Error("Writings markers must be inside the writing list");
  const listOpenEnd = html.indexOf(">", listOpen) + 1;
  const listClose = html.indexOf("</ol>", listOpenEnd);
  if (listClose < 0 || startIndex < listOpenEnd || endIndex > listClose) {
    throw new Error("Writings markers must be inside the writing list");
  }

  const lineStart = html.lastIndexOf("\n", startIndex) + 1;
  const markerIndent = html.slice(lineStart, startIndex);
  if (!/^\s*$/.test(markerIndent)) throw new Error("Writings start marker must begin its line");

  const replacement = `\n${renderWritingRows(records)}\n${markerIndent}`;
  const contentStart = startIndex + WRITINGS_START_MARKER.length;
  return html.slice(0, contentStart) + replacement + html.slice(endIndex);
}

function parseSafeHttpsUrl(input: unknown): URL | null {
  if (typeof input !== "string" || input.trim() === "") return null;
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
    return url;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned === "" ? null : cleaned;
}

function normalizeWritingRecord(record: WritingRecord): WritingRecord {
  const title = cleanText(record.title);
  const author = cleanText(record.author);
  const publishedAt = normalizeUtcDate(record.publishedAt);
  if (!title || !author || !publishedAt || publishedAt !== record.publishedAt) {
    throw new Error("Writing record has invalid text or date");
  }

  let url: string | null;
  if (record.source === "substack") {
    url = canonicalizeSubstackUrl(record.url);
  } else if (record.source === "x-article") {
    url = canonicalizeXArticleUrl(record.url);
  } else {
    throw new Error("Writing record has an invalid source");
  }
  if (!url) throw new Error("Writing record URL must use a safe https URL");

  return { title, author, publishedAt, url, source: record.source };
}

function canonicalizeXArticleUrl(input: unknown): string | null {
  const url = parseSafeHttpsUrl(input);
  if (!url || url.hostname !== "x.com") return null;
  const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)\/?$/);
  if (!match) return null;
  return `https://x.com/${match[1]}/status/${match[2]}`;
}

function compareDuplicateCandidates(
  left: { record: WritingRecord; fetched: boolean },
  right: { record: WritingRecord; fetched: boolean },
): number {
  if (left.record.publishedAt !== right.record.publishedAt) {
    return left.record.publishedAt > right.record.publishedAt ? -1 : 1;
  }
  if (left.fetched !== right.fetched) return left.fetched ? -1 : 1;

  const title = compareCodePoints(left.record.title, right.record.title);
  if (title !== 0) return title;
  return compareCodePoints(left.record.author, right.record.author);
}

function compareWritingRecords(left: WritingRecord, right: WritingRecord): number {
  if (left.publishedAt !== right.publishedAt) return left.publishedAt > right.publishedAt ? -1 : 1;
  const title = compareCodePoints(left.title, right.title);
  if (title !== 0) return title;
  return compareCodePoints(left.url, right.url);
}

function uniqueMarkerIndex(html: string, marker: string): number {
  const first = html.indexOf(marker);
  if (first < 0 || html.indexOf(marker, first + marker.length) >= 0) {
    throw new Error("Expected exactly one writings marker");
  }
  return first;
}
