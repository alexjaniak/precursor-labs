import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createContactHandler } from "../worker/contact.ts";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const PRODUCTION_ORIGIN = "https://precursorlabs.org";
const SUBSTACK_FEED_URL = "https://dylanvu.substack.com/feed";

const env = {
  ALLOWED_ORIGIN: PRODUCTION_ORIGIN,
  TURNSTILE_HOSTNAME: "precursorlabs.org",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/contact",
};

const validPayload = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Please tell me more about Precursor Labs.",
  website: "",
  turnstileToken: "verified-token",
};

function jsonRequest(
  payload = validPayload,
  {
    origin = PRODUCTION_ORIGIN,
    method = "POST",
    headers = {},
    url = "https://precursorlabs.org/contact",
  } = {},
) {
  const requestHeaders = new Headers(headers);
  if (origin !== null) {
    requestHeaders.set("Origin", origin);
  }
  if (!requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  return new Request(url, {
    method,
    headers: requestHeaders,
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(payload),
  });
}

function createFetch({
  verification = {
    success: true,
    action: "contact",
    hostname: "precursorlabs.org",
  },
  verificationStatus = 200,
  slackStatus = 200,
  onSiteverify,
  onSlack,
} = {}) {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.url;

    if (url === SITEVERIFY_URL) {
      onSiteverify?.(init);
      return new Response(JSON.stringify(verification), {
        status: verificationStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url === env.SLACK_WEBHOOK_URL) {
      onSlack?.(init);
      return new Response(slackStatus === 200 ? "ok" : "error", {
        status: slackStatus,
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
}

async function readJson(response) {
  return JSON.parse(await response.text());
}

async function assertError(response, status, code) {
  assert.equal(response.status, status);
  const body = await readJson(response);
  assert.deepEqual(body, { ok: false, code });
  assert.equal("error" in body, false);
}

function assertAllowedResponseHeaders(response, origin = PRODUCTION_ORIGIN) {
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Vary"), "Origin");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
}

test("accepts each exact allowed origin and returns no-store CORS headers", async () => {
  for (const origin of [
    PRODUCTION_ORIGIN,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ]) {
    const handler = createContactHandler(createFetch());
    const response = await handler(jsonRequest(validPayload, { origin }), env);

    assert.equal(response.status, 200);
    assert.deepEqual(await readJson(response), { ok: true });
    assertAllowedResponseHeaders(response, origin);
  }
});

test("uses the configured production origin and keeps the exact local origins", async () => {
  const configuredOrigin = "https://contact.preview.test";
  const configuredEnv = { ...env, ALLOWED_ORIGIN: configuredOrigin };
  const handler = createContactHandler(createFetch());

  for (const origin of [
    configuredOrigin,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ]) {
    const response = await handler(
      jsonRequest(validPayload, { origin }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    assertAllowedResponseHeaders(response, origin);
  }

  const staleProductionResponse = await handler(
    jsonRequest(validPayload, { origin: PRODUCTION_ORIGIN }),
    configuredEnv,
  );
  await assertError(staleProductionResponse, 403, "origin_not_allowed");
  assert.equal(
    staleProductionResponse.headers.get("Access-Control-Allow-Origin"),
    null,
  );
});

test("rejects missing and inexact origins", async () => {
  const handler = createContactHandler(createFetch());

  for (const origin of [
    null,
    "https://www.precursorlabs.org",
    "https://precursorlabs.org.evil.test",
    "http://localhost:5174",
  ]) {
    const response = await handler(jsonRequest(validPayload, { origin }), env);
    await assertError(response, 403, "origin_not_allowed");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(response.headers.get("Vary"), "Origin");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("returns the exact preflight response for an allowed origin", async () => {
  const handler = createContactHandler(createFetch());
  const response = await handler(
    new Request("https://precursorlabs.org/contact", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    }),
    env,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  assert.equal(response.headers.get("Vary"), "Origin");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(await response.text(), "");
});

test("rejects allowed-origin methods other than POST and OPTIONS", async () => {
  const handler = createContactHandler(createFetch());
  const response = await handler(
    jsonRequest(validPayload, { method: "PUT" }),
    env,
  );

  await assertError(response, 405, "method_not_allowed");
  assertAllowedResponseHeaders(response);
});

test("rejects POST and OPTIONS on paths other than /contact", async () => {
  const handler = createContactHandler(async () => {
    throw new Error("External fetch must not run");
  });
  const requests = [
    jsonRequest(validPayload, {
      url: "https://precursorlabs.org/not-contact",
    }),
    new Request("https://precursorlabs.org/not-contact", {
      method: "OPTIONS",
      headers: { Origin: PRODUCTION_ORIGIN },
    }),
  ];

  for (const request of requests) {
    const response = await handler(request, env);
    await assertError(response, 405, "method_not_allowed");
    assertAllowedResponseHeaders(response);
    assert.equal(response.headers.get("Access-Control-Allow-Methods"), null);
  }
});

test("proxies only an allowlisted Substack feed without requiring a browser origin", async () => {
  let upstreamRequest;
  const handler = createContactHandler(async (input, init) => {
    upstreamRequest = { url: String(input), init };
    return new Response("<rss><channel /></rss>", {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  });

  const response = await handler(
    new Request(
      `https://precursorlabs.org/writings/substack?feed=${encodeURIComponent(SUBSTACK_FEED_URL)}`,
    ),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<rss><channel /></rss>");
  assert.equal(response.headers.get("Content-Type"), "application/xml; charset=utf-8");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=300");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(upstreamRequest.url, SUBSTACK_FEED_URL);
  assert.match(upstreamRequest.init.headers["User-Agent"], /PrecursorLabsWritingSync\/1\.0/);
});

test("rejects unknown feed targets and non-GET feed methods before external fetch", async () => {
  const handler = createContactHandler(async () => {
    throw new Error("External fetch must not run");
  });

  const unknownFeed = await handler(
    new Request(
      `https://precursorlabs.org/writings/substack?feed=${encodeURIComponent("https://evil.test/feed")}`,
    ),
    env,
  );
  assert.equal(unknownFeed.status, 400);

  const wrongMethod = await handler(
    new Request(
      `https://precursorlabs.org/writings/substack?feed=${encodeURIComponent(SUBSTACK_FEED_URL)}`,
      { method: "POST" },
    ),
    env,
  );
  assert.equal(wrongMethod.status, 405);
});

test("rejects a non-JSON content type", async () => {
  const handler = createContactHandler(createFetch());
  const response = await handler(
    jsonRequest(validPayload, { headers: { "Content-Type": "text/plain" } }),
    env,
  );

  await assertError(response, 415, "unsupported_media_type");
  assertAllowedResponseHeaders(response);
});

test("accepts application/json with a charset", async () => {
  const handler = createContactHandler(createFetch());
  const response = await handler(
    jsonRequest(validPayload, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
    env,
  );

  assert.equal(response.status, 200);
});

test("rejects a declared body larger than 8192 bytes", async () => {
  const handler = createContactHandler(createFetch());
  const response = await handler(
    jsonRequest(validPayload, { headers: { "Content-Length": "8193" } }),
    env,
  );

  await assertError(response, 413, "request_too_large");
});

test("rejects an actual body larger than 8192 UTF-8 bytes", async () => {
  const handler = createContactHandler(createFetch());
  const oversized = JSON.stringify({
    ...validPayload,
    message: "é".repeat(4100),
  });
  assert.ok(oversized.length < 8192);
  assert.ok(new TextEncoder().encode(oversized).byteLength > 8192);
  const response = await handler(
    new Request("https://precursorlabs.org/contact", {
      method: "POST",
      headers: {
        Origin: PRODUCTION_ORIGIN,
        "Content-Type": "application/json",
      },
      body: oversized,
    }),
    env,
  );

  await assertError(response, 413, "request_too_large");
});

test("rejects invalid JSON, arrays, unknown keys, and non-string values", async (t) => {
  const handler = createContactHandler(createFetch());

  await t.test("invalid JSON", async () => {
    const response = await handler(
      new Request("https://precursorlabs.org/contact", {
        method: "POST",
        headers: {
          Origin: PRODUCTION_ORIGIN,
          "Content-Type": "application/json",
        },
        body: "{",
      }),
      env,
    );
    await assertError(response, 400, "invalid_request");
  });

  for (const [label, payload] of [
    ["array", []],
    ["unknown key", { ...validPayload, role: "admin" }],
    ["non-string value", { ...validPayload, name: 42 }],
  ]) {
    await t.test(label, async () => {
      const response = await handler(jsonRequest(payload), env);
      await assertError(response, 400, "invalid_request");
    });
  }
});

test("trims valid fields before verification and Slack delivery", async () => {
  let slackPayload;
  const handler = createContactHandler(
    createFetch({
      onSlack(init) {
        slackPayload = JSON.parse(init.body);
      },
    }),
  );
  const response = await handler(
    jsonRequest({
      ...validPayload,
      name: "  Ada Lovelace  ",
      email: "  ada@example.com  ",
      message: "  A useful contact message.  ",
      turnstileToken: "  verified-token  ",
    }),
    env,
  );

  assert.equal(response.status, 200);
  const rendered = JSON.stringify(slackPayload);
  assert.match(rendered, /Ada Lovelace/);
  assert.match(rendered, /ada@example\.com/);
  assert.match(rendered, /A useful contact message\./);
  assert.doesNotMatch(rendered, /  Ada Lovelace  /);
});

test("enforces every field limit and email shape", async (t) => {
  const handler = createContactHandler(createFetch());
  const invalidCases = [
    ["short name", { name: "a" }],
    ["long name", { name: "a".repeat(101) }],
    ["short email", { email: "a@b" }],
    ["long email", { email: `${"a".repeat(251)}@b.c` }],
    ["email without at", { email: "user.example.com" }],
    ["email with two at signs", { email: "user@@example.com" }],
    ["email with whitespace", { email: "user name@example.com" }],
    ["email with line break", { email: "user@example.com\ncc@example.com" }],
    ["short message", { message: "x".repeat(9) }],
    ["long message", { message: "x".repeat(2801) }],
    ["empty token", { turnstileToken: "" }],
    ["long token", { turnstileToken: "x".repeat(2049) }],
  ];

  for (const [label, patch] of invalidCases) {
    await t.test(label, async () => {
      const response = await handler(
        jsonRequest({ ...validPayload, ...patch }),
        env,
      );
      await assertError(response, 400, "invalid_request");
    });
  }
});

test("rejects a non-empty honeypot before external requests", async () => {
  let requestCount = 0;
  const handler = createContactHandler(async () => {
    requestCount += 1;
    throw new Error("External fetch must not run");
  });
  const response = await handler(
    jsonRequest({ ...validPayload, website: "https://spam.test" }),
    env,
  );

  await assertError(response, 403, "verification_failed");
  assert.equal(requestCount, 0);
});

test("sends the Turnstile secret, token, and optional connecting IP", async () => {
  let verificationInit;
  const handler = createContactHandler(
    createFetch({ onSiteverify: (init) => (verificationInit = init) }),
  );
  const request = jsonRequest(validPayload, {
    headers: { "CF-Connecting-IP": "203.0.113.42" },
  });
  const response = await handler(request, env);

  assert.equal(response.status, 200);
  assert.equal(verificationInit.method, "POST");
  assert.ok(verificationInit.signal instanceof AbortSignal);
  const params = new URLSearchParams(verificationInit.body);
  assert.equal(params.get("secret"), env.TURNSTILE_SECRET_KEY);
  assert.equal(params.get("response"), validPayload.turnstileToken);
  assert.equal(params.get("remoteip"), "203.0.113.42");
});

test("omits remoteip when Cloudflare does not supply one", async () => {
  let verificationInit;
  const handler = createContactHandler(
    createFetch({ onSiteverify: (init) => (verificationInit = init) }),
  );
  const response = await handler(jsonRequest(), env);

  assert.equal(response.status, 200);
  const params = new URLSearchParams(verificationInit.body);
  assert.equal(params.has("remoteip"), false);
});

test("rejects unsuccessful, wrong-action, and wrong-hostname verification", async (t) => {
  for (const [label, verification] of [
    ["unsuccessful", { success: false }],
    [
      "wrong action",
      { success: true, action: "newsletter", hostname: "precursorlabs.org" },
    ],
    [
      "wrong hostname",
      { success: true, action: "contact", hostname: "evil.test" },
    ],
  ]) {
    await t.test(label, async () => {
      const handler = createContactHandler(createFetch({ verification }));
      const response = await handler(jsonRequest(), env);
      await assertError(response, 403, "verification_failed");
    });
  }
});

test("returns verification_unavailable for fetch, timeout, non-OK, and invalid JSON failures", async (t) => {
  await t.test("fetch failure", async () => {
    const handler = createContactHandler(async () => {
      throw new Error("network unavailable");
    });
    const response = await handler(jsonRequest(), env);
    await assertError(response, 503, "verification_unavailable");
  });

  await t.test("timeout abort", async () => {
    const handler = createContactHandler(async (_input, init) => {
      assert.ok(init.signal instanceof AbortSignal);
      throw new DOMException("Timed out", "AbortError");
    });
    const response = await handler(jsonRequest(), env);
    await assertError(response, 503, "verification_unavailable");
  });

  await t.test("non-OK response", async () => {
    const handler = createContactHandler(
      createFetch({ verificationStatus: 500 }),
    );
    const response = await handler(jsonRequest(), env);
    await assertError(response, 503, "verification_unavailable");
  });

  await t.test("invalid JSON response", async () => {
    const handler = createContactHandler(async (input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url === SITEVERIFY_URL) {
        return new Response("not-json", { status: 200 });
      }
      throw new Error("Slack must not run");
    });
    const response = await handler(jsonRequest(), env);
    await assertError(response, 503, "verification_unavailable");
  });
});

test("sends user values only in inert Slack plain_text objects", async () => {
  const hostilePayload = {
    ...validPayload,
    name: "<& <!channel> <@USER>",
    email: "user<&>@example.com",
    message: "Keep &, <, >, <!channel>, and <@USER> inert.",
  };
  let slackInit;
  const handler = createContactHandler(
    createFetch({ onSlack: (init) => (slackInit = init) }),
  );
  const response = await handler(jsonRequest(hostilePayload), env);

  assert.equal(response.status, 200);
  assert.equal(slackInit.method, "POST");
  assert.equal(slackInit.headers["Content-Type"], "application/json");
  assert.ok(slackInit.signal instanceof AbortSignal);
  const payload = JSON.parse(slackInit.body);
  assert.equal("channel" in payload, false);
  assert.doesNotMatch(JSON.stringify(payload), /mrkdwn/);
  const textObjects = payload.blocks.map((block) => block.text);
  assert.ok(textObjects.length >= 3);
  assert.ok(textObjects.every((text) => text.type === "plain_text"));
  const rendered = textObjects.map((text) => text.text).join("\n");
  assert.match(rendered, /<& <!channel> <@USER>/);
  assert.match(rendered, /user<&>@example\.com/);
  assert.match(rendered, /Keep &, <, >, <!channel>, and <@USER> inert\./);
});

test("returns delivery_failed for a non-OK Slack response", async () => {
  const handler = createContactHandler(createFetch({ slackStatus: 500 }));
  const response = await handler(jsonRequest(), env);
  await assertError(response, 502, "delivery_failed");
});

test("returns delivery_failed when Slack fetch throws", async () => {
  const handler = createContactHandler(async (input) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === SITEVERIFY_URL) {
      return new Response(
        JSON.stringify({
          success: true,
          action: "contact",
          hostname: "precursorlabs.org",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error("Slack unavailable");
  });
  const response = await handler(jsonRequest(), env);
  await assertError(response, 502, "delivery_failed");
});

test("returns delivery_failed when the Slack timeout aborts", async () => {
  let slackSignal;
  const handler = createContactHandler(async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === SITEVERIFY_URL) {
      return new Response(
        JSON.stringify({
          success: true,
          action: "contact",
          hostname: "precursorlabs.org",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    slackSignal = init.signal;
    throw new DOMException("Timed out", "AbortError");
  });

  const response = await handler(jsonRequest(), env);

  await assertError(response, 502, "delivery_failed");
  assert.ok(slackSignal instanceof AbortSignal);
});

test("the normal TypeScript check includes the Worker source", async () => {
  const tsconfig = JSON.parse(
    await readFile(new URL("../tsconfig.json", import.meta.url), "utf8"),
  );
  assert.ok(tsconfig.include.includes("worker"));
});
