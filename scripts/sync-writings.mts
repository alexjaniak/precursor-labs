import {
  copyFile as nodeCopyFile,
  readFile as nodeReadFile,
  rename as nodeRename,
  unlink as nodeUnlink,
  writeFile as nodeWriteFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  compareCodePoints,
  mergeWritings,
  parseRssFeed,
  parseXArticles,
  replaceWritingsMarkerContent,
  stableJson,
  type SubstackSource,
  type WritingRecord,
  type XSource,
} from "./lib/writings.ts";

interface SyncPaths {
  config: string;
  writings: string;
  state: string;
  html: string;
}

interface FileAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, value: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

interface SyncLogger {
  info(message: string): void;
  error(message: string): void;
}

interface WritingConfig {
  substack: SubstackSource[];
  x: XSource[];
}

interface XAccountState {
  sinceId: string;
}

interface WritingSyncState {
  xAccounts: Record<string, XAccountState>;
}

export interface WritingsSyncOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  fs?: FileAdapter;
  env?: Record<string, string | undefined>;
  paths?: SyncPaths;
  logger?: SyncLogger;
}

export interface WritingsSyncResult {
  substack: { succeeded: number; failed: string[] };
  x: { status: "not-configured" | "skipped" | "ok" | "partial" | "failed"; succeeded: number; failed: string[] };
  writingCount: number;
  changed: boolean;
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_X_PAGES = 100;

const SUBSTACK_REQUEST_HEADERS = {
  Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (compatible; PrecursorLabsWritingSync/1.0; +https://precursorlabs.org)",
} as const;

const defaultPaths: SyncPaths = {
  config: resolve(repoRoot, "config/writing-sources.json"),
  writings: resolve(repoRoot, "data/writings.json"),
  state: resolve(repoRoot, "data/writing-sync-state.json"),
  html: resolve(repoRoot, "index.html"),
};

const defaultFs: FileAdapter = {
  readFile: (path) => nodeReadFile(path, "utf8"),
  writeFile: (path, value) => nodeWriteFile(path, value, "utf8"),
  copyFile: nodeCopyFile,
  rename: nodeRename,
  unlink: nodeUnlink,
};

export async function runWritingsSync(options: WritingsSyncOptions = {}): Promise<WritingsSyncResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const fs = options.fs ?? defaultFs;
  const env = options.env ?? process.env;
  const paths = options.paths ?? defaultPaths;
  const logger = options.logger ?? console;

  const [configText, writingsText, stateText, htmlText] = await Promise.all([
    fs.readFile(paths.config),
    fs.readFile(paths.writings),
    fs.readFile(paths.state),
    fs.readFile(paths.html),
  ]);

  const config = parseConfig(configText);
  const historical = parseWritings(writingsText);
  const state = parseState(stateText);
  validateHtml(htmlText, historical);
  if (config.substack.length + config.x.length === 0) {
    throw new Error("No remote sources are configured");
  }
  const runStart = now();

  const fetched: WritingRecord[] = [];
  const substackFailed: string[] = [];
  let substackSucceeded = 0;

  for (const source of config.substack) {
    try {
      const response = await fetchSubstackFeed(
        source,
        fetchImpl,
        env.SUBSTACK_PROXY_BASE,
        logger,
      );
      const records = parseRssFeed(await response.text(), source);
      if (records.length === 0) throw new Error("Feed has no usable items");
      fetched.push(...records);
      substackSucceeded += 1;
      logger.info(`Substack source succeeded: ${source.feedUrl} (${records.length})`);
    } catch {
      substackFailed.push(source.feedUrl);
      logger.error(`Substack source failed: ${source.feedUrl}`);
    }
  }

  const nextCursors = new Map<string, string>();
  const xFailed: string[] = [];
  let xSucceeded = 0;
  let xStatus: WritingsSyncResult["x"]["status"] = config.x.length === 0 ? "not-configured" : "skipped";
  const token = env.X_API_BEARER_TOKEN?.trim();

  if (config.x.length > 0 && token) {
    const resolved = await resolveXAccounts(config.x, token, fetchImpl, logger);
    if (!resolved) {
      xFailed.push(...config.x.map(({ username }) => username));
    } else {
      for (const source of config.x) {
        const accountId = resolved.get(source.username.toLowerCase());
        if (!accountId) {
          xFailed.push(source.username);
          logger.error(`X source failed: ${source.username}`);
          continue;
        }

        const oldCursor = findCursor(state, source.username);
        const account = await fetchXAccount({
          accountId,
          source,
          token,
          oldCursor,
          fetchImpl,
          runStart,
          logger,
        });
        if (!account) {
          xFailed.push(source.username);
          logger.error(`X source failed: ${source.username}`);
          continue;
        }

        fetched.push(...account.records);
        if (account.newestId) nextCursors.set(source.username, account.newestId);
        xSucceeded += 1;
        logger.info(`X source succeeded: ${source.username} (${account.records.length})`);
      }
    }

    xStatus = xSucceeded === config.x.length ? "ok" : xSucceeded > 0 ? "partial" : "failed";
  } else if (config.x.length > 0) {
    logger.info(`X sources skipped: missing X_API_BEARER_TOKEN (${config.x.length})`);
  }

  if (substackSucceeded + xSucceeded === 0) {
    throw new Error("Every configured remote source failed or was unavailable");
  }

  const merged = mergeWritings(historical, fetched);
  const nextState = buildState(config.x, state, nextCursors);
  const nextWritingsText = stableJson(merged);
  const nextStateText = stableJson(nextState);
  const nextHtmlText = replaceWritingsMarkerContent(htmlText, merged);

  parseWritings(nextWritingsText);
  parseState(nextStateText);
  validateHtml(nextHtmlText, merged);

  const outputs = [
    { path: paths.writings, value: nextWritingsText },
    { path: paths.html, value: nextHtmlText },
    { path: paths.state, value: nextStateText },
  ];
  await atomicWriteAll(fs, outputs);

  return {
    substack: { succeeded: substackSucceeded, failed: substackFailed },
    x: { status: xStatus, succeeded: xSucceeded, failed: xFailed },
    writingCount: merged.length,
    changed:
      nextWritingsText !== writingsText || nextStateText !== stateText || nextHtmlText !== htmlText,
  };
}

async function fetchSubstackFeed(
  source: SubstackSource,
  fetchImpl: typeof fetch,
  proxyBaseValue: string | undefined,
  logger: SyncLogger,
): Promise<Response> {
  let directResponse: Response | undefined;
  try {
    directResponse = await fetchImpl(source.feedUrl, {
      headers: SUBSTACK_REQUEST_HEADERS,
      signal: requestSignal(),
    });
    if (directResponse.ok) return directResponse;
  } catch {
    // Use the configured proxy when a runner cannot reach Substack directly.
  }

  const proxyUrl = makeSubstackProxyUrl(proxyBaseValue, source.feedUrl);
  if (!proxyUrl) {
    if (directResponse) {
      logRemoteStatus(logger, `Substack source ${source.feedUrl}`, directResponse);
    }
    throw new Error("Remote response was not OK");
  }

  const proxyResponse = await fetchImpl(proxyUrl, {
    headers: SUBSTACK_REQUEST_HEADERS,
    signal: requestSignal(),
  });
  if (!proxyResponse.ok) {
    logRemoteStatus(logger, `Substack source ${source.feedUrl}`, proxyResponse);
    throw new Error("Proxy response was not OK");
  }
  return proxyResponse;
}

function makeSubstackProxyUrl(
  proxyBaseValue: string | undefined,
  feedUrl: string,
): URL | null {
  const proxyBase = proxyBaseValue?.trim();
  if (!proxyBase) return null;

  try {
    const proxyUrl = new URL(proxyBase);
    if (
      proxyUrl.protocol !== "https:" ||
      proxyUrl.username !== "" ||
      proxyUrl.password !== ""
    ) {
      return null;
    }
    proxyUrl.searchParams.set("feed", feedUrl);
    return proxyUrl;
  } catch {
    return null;
  }
}

async function resolveXAccounts(
  sources: readonly XSource[],
  token: string,
  fetchImpl: typeof fetch,
  logger: SyncLogger,
): Promise<Map<string, string> | null> {
  const url = new URL("https://api.x.com/2/users/by");
  url.searchParams.set("usernames", sources.map(({ username }) => username).join(","));
  url.searchParams.set("user.fields", "username");

  try {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: requestSignal(),
    });
    if (!response.ok) {
      logRemoteStatus(
        logger,
        `X resolver ${sources.map(({ username }) => username).join(",")}`,
        response,
      );
      return null;
    }
    const body = asRecord(await response.json());
    if (!body || !Array.isArray(body.data)) return null;

    const result = new Map<string, string>();
    let malformedEntry = false;
    for (const value of body.data) {
      const account = asRecord(value);
      const id = cleanString(account?.id);
      const username = cleanString(account?.username);
      if (!id || !/^\d+$/.test(id) || !username) {
        malformedEntry = true;
        continue;
      }
      result.set(username.toLowerCase(), id);
    }
    if (malformedEntry || result.size === 0) return null;
    if (hasTopLevelErrors(body)) {
      const unresolvedCount = sources.filter(
        ({ username }) => !result.has(username.toLowerCase()),
      ).length;
      logger.error(`X resolver reported unresolved handles: ${unresolvedCount}`);
    }
    return result;
  } catch {
    return null;
  }
}

async function fetchXAccount(input: {
  accountId: string;
  source: XSource;
  token: string;
  oldCursor: string | undefined;
  fetchImpl: typeof fetch;
  runStart: Date;
  logger: SyncLogger;
}): Promise<{ records: WritingRecord[]; newestId?: string } | null> {
  const allPosts: unknown[] = [];
  const candidateIds: string[] = input.oldCursor ? [input.oldCursor] : [];
  const seenNextTokens = new Set<string>();
  let pageCount = 0;
  let paginationToken: string | undefined;
  const startTime = new Date(input.runStart.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  do {
    if (pageCount >= MAX_X_PAGES) return null;
    pageCount += 1;
    const url = new URL(`https://api.x.com/2/users/${input.accountId}/tweets`);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("exclude", "replies,retweets");
    url.searchParams.set("tweet.fields", "article,article_title,created_at,referenced_tweets");
    if (input.oldCursor) url.searchParams.set("since_id", input.oldCursor);
    else url.searchParams.set("start_time", startTime);
    if (paginationToken) url.searchParams.set("pagination_token", paginationToken);

    try {
      const response = await input.fetchImpl(url, {
        headers: { Authorization: `Bearer ${input.token}` },
        signal: requestSignal(),
      });
      if (!response.ok) {
        logRemoteStatus(input.logger, `X source ${input.source.username}`, response);
        return null;
      }
      const body = asRecord(await response.json());
      if (
        !body ||
        hasTopLevelErrors(body) ||
        (body.data !== undefined && !Array.isArray(body.data))
      ) {
        return null;
      }
      const posts = Array.isArray(body.data) ? body.data : [];
      allPosts.push(...posts);
      for (const value of posts) {
        const id = cleanString(asRecord(value)?.id);
        if (id && /^\d+$/.test(id)) candidateIds.push(id);
      }

      const meta = asRecord(body.meta);
      const newestId = cleanString(meta?.newest_id);
      if (newestId && /^\d+$/.test(newestId)) candidateIds.push(newestId);
      const nextToken = cleanString(meta?.next_token);
      if (nextToken && seenNextTokens.has(nextToken)) return null;
      if (nextToken) seenNextTokens.add(nextToken);
      paginationToken = nextToken ?? undefined;
    } catch {
      return null;
    }
  } while (paginationToken);

  return {
    records: parseXArticles({ data: allPosts }, input.source),
    newestId: highestNumericString(candidateIds),
  };
}

function parseConfig(text: string): WritingConfig {
  const value = parseJsonRecord(text, "writing source config");
  if (!Array.isArray(value.substack) || !Array.isArray(value.x)) {
    throw new Error("Writing source config must contain substack and x arrays");
  }

  const substack = value.substack.map((entry, index) => {
    const source = asRecord(entry);
    const feedUrl = cleanString(source?.feedUrl);
    const author = cleanString(source?.author);
    if (!feedUrl || !author || !isSafeHttpsUrl(feedUrl)) {
      throw new Error(`Invalid Substack source at index ${index}`);
    }
    return { feedUrl, author };
  });
  const x = value.x.map((entry, index) => {
    const source = asRecord(entry);
    const username = cleanString(source?.username)?.replace(/^@/, "");
    const author = cleanString(source?.author);
    if (!username || !/^[A-Za-z0-9_]{1,15}$/.test(username) || !author) {
      throw new Error(`Invalid X source at index ${index}`);
    }
    return { username, author };
  });

  assertUnique(substack.map(({ feedUrl }) => feedUrl), "Substack source");
  assertUnique(x.map(({ username }) => username.toLowerCase()), "X source");
  return { substack, x };
}

function parseWritings(text: string): WritingRecord[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Writings JSON is invalid");
  }
  if (!Array.isArray(value)) throw new Error("Writings JSON must be an array");
  try {
    return mergeWritings([], value as WritingRecord[]);
  } catch {
    throw new Error("Writings JSON has an invalid record");
  }
}

function parseState(text: string): WritingSyncState {
  const value = parseJsonRecord(text, "writing sync state");
  const accounts = asRecord(value.xAccounts);
  if (!accounts) throw new Error("Writing sync state must contain an xAccounts object");

  const xAccounts: Record<string, XAccountState> = {};
  for (const [username, entry] of Object.entries(accounts)) {
    const account = asRecord(entry);
    const sinceId = cleanString(account?.sinceId);
    if (!/^[A-Za-z0-9_]{1,15}$/.test(username) || !sinceId || !/^\d+$/.test(sinceId)) {
      throw new Error(`Writing sync state has an invalid account: ${username}`);
    }
    xAccounts[username] = { sinceId };
  }
  return { xAccounts };
}

function validateHtml(html: string, writings: readonly WritingRecord[]): void {
  const regenerated = replaceWritingsMarkerContent(html, writings);
  if (typeof regenerated !== "string") throw new Error("Writings HTML is invalid");
}

function buildState(
  sources: readonly XSource[],
  current: WritingSyncState,
  updates: ReadonlyMap<string, string>,
): WritingSyncState {
  const xAccounts: Record<string, XAccountState> = {};
  const usedCurrentKeys = new Set<string>();

  for (const source of sources) {
    const currentEntry = findStateEntry(current, source.username);
    if (currentEntry) usedCurrentKeys.add(currentEntry.key);
    const sinceId = updates.get(source.username) ?? currentEntry?.value.sinceId;
    if (sinceId) xAccounts[source.username] = { sinceId };
  }

  const remaining = Object.entries(current.xAccounts)
    .filter(([username]) => !usedCurrentKeys.has(username))
    .sort(([left], [right]) => compareCodePoints(left, right));
  for (const [username, value] of remaining) xAccounts[username] = value;
  return { xAccounts };
}

function findCursor(state: WritingSyncState, username: string): string | undefined {
  return findStateEntry(state, username)?.value.sinceId;
}

function findStateEntry(
  state: WritingSyncState,
  username: string,
): { key: string; value: XAccountState } | undefined {
  const target = username.toLowerCase();
  for (const [key, value] of Object.entries(state.xAccounts)) {
    if (key.toLowerCase() === target) return { key, value };
  }
  return undefined;
}

async function atomicWriteAll(
  fs: FileAdapter,
  outputs: readonly { path: string; value: string }[],
): Promise<void> {
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tempPaths = outputs.map(({ path }, index) =>
    join(dirname(path), `${path.split(/[\\/]/).pop()}.tmp-${nonce}-${index}`),
  );
  const backupPaths = outputs.map(({ path }, index) =>
    join(dirname(path), `${path.split(/[\\/]/).pop()}.backup-${nonce}-${index}`),
  );
  const promoted = new Set<number>();

  try {
    for (let index = 0; index < outputs.length; index += 1) {
      await fs.writeFile(tempPaths[index], outputs[index].value);
    }
    for (let index = 0; index < outputs.length; index += 1) {
      await fs.copyFile(outputs[index].path, backupPaths[index]);
    }
    for (let index = 0; index < outputs.length; index += 1) {
      await fs.rename(tempPaths[index], outputs[index].path);
      promoted.add(index);
    }
    await Promise.all(backupPaths.map((path) => fs.unlink(path).catch(() => undefined)));
  } catch (error) {
    let rollbackError: unknown;
    const restored = new Set<number>();
    for (let index = outputs.length - 1; index >= 0; index -= 1) {
      if (!promoted.has(index)) continue;
      try {
        await fs.rename(backupPaths[index], outputs[index].path);
        restored.add(index);
      } catch (caught) {
        rollbackError ??= caught;
      }
    }
    await Promise.all(tempPaths.map((path) => fs.unlink(path).catch(() => undefined)));
    await Promise.all(
      backupPaths.map((path, index) =>
        !promoted.has(index) || restored.has(index)
          ? fs.unlink(path).catch(() => undefined)
          : Promise.resolve(),
      ),
    );
    if (rollbackError) {
      throw new AggregateError([error, rollbackError], "Writings transaction and rollback failed");
    }
    throw error;
  }
}

function requestSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function hasTopLevelErrors(body: Record<string, unknown>): boolean {
  return Array.isArray(body.errors) && body.errors.length > 0;
}

function logRemoteStatus(logger: SyncLogger, source: string, response: Response): void {
  const rateLimitReset = response.headers.get("x-rate-limit-reset");
  const rateLimit = rateLimitReset ? `; rate-limit-reset ${rateLimitReset}` : "";
  logger.error(`${source} failed: HTTP ${response.status}${rateLimit}`);
}

function parseJsonRecord(text: string, label: string): Record<string, unknown> {
  try {
    const value = asRecord(JSON.parse(text));
    if (value) return value;
  } catch {
    // Use the same bounded error below.
  }
  throw new Error(`Invalid ${label}`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned === "" ? null : cleaned;
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} entries must be unique`);
}

function highestNumericString(values: readonly string[]): string | undefined {
  let highest: string | undefined;
  for (const value of values) {
    if (!highest || BigInt(value) > BigInt(highest)) highest = value;
  }
  return highest;
}

export function formatSyncSummary(result: WritingsSyncResult): string {
  return (
    `Writings sync complete: ${result.writingCount} records; ` +
    `Substack ${result.substack.succeeded} succeeded, ${result.substack.failed.length} failed; ` +
    `X ${result.x.succeeded} succeeded, ${result.x.failed.length} failed`
  );
}

const isDirectRun =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  runWritingsSync()
    .then((result) => {
      console.info(formatSyncSummary(result));
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown writings sync error";
      console.error(`Writings sync failed: ${message}`);
      process.exitCode = 1;
    });
}
