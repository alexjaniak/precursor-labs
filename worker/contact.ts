const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_BODY_BYTES = 8192;
const LOCAL_ORIGINS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);
const ACCEPTED_KEYS = new Set([
  "name",
  "email",
  "message",
  "website",
  "turnstileToken",
]);

export type Env = {
  ALLOWED_ORIGIN: string;
  TURNSTILE_HOSTNAME: string;
  TURNSTILE_SECRET_KEY: string;
  SLACK_WEBHOOK_URL: string;
};

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type ContactPayload = {
  name: string;
  email: string;
  message: string;
  website: string;
  turnstileToken: string;
};

type ErrorCode =
  | "invalid_request"
  | "origin_not_allowed"
  | "verification_failed"
  | "method_not_allowed"
  | "request_too_large"
  | "unsupported_media_type"
  | "delivery_failed"
  | "verification_unavailable";

function responseHeaders(origin?: string): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  });

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

function jsonResponse(
  body: { ok: true } | { ok: false; code: ErrorCode },
  status: number,
  origin?: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

function errorResponse(
  error: ErrorCode,
  status: number,
  origin?: string,
): Response {
  return jsonResponse({ ok: false, code: error }, status, origin);
}

function preflightResponse(origin: string): Response {
  const headers = responseHeaders(origin);
  headers.delete("Content-Type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(null, { status: 204, headers });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePayload(value: unknown): ContactPayload | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (
    keys.some((key) => !ACCEPTED_KEYS.has(key)) ||
    [...ACCEPTED_KEYS].some((key) => typeof value[key] !== "string")
  ) {
    return null;
  }

  const payload = {
    name: (value.name as string).trim(),
    email: (value.email as string).trim(),
    message: (value.message as string).trim(),
    website: (value.website as string).trim(),
    turnstileToken: (value.turnstileToken as string).trim(),
  };

  const emailAtCount = [...payload.email].filter(
    (character) => character === "@",
  ).length;

  if (
    payload.name.length < 2 ||
    payload.name.length > 100 ||
    payload.email.length < 5 ||
    payload.email.length > 254 ||
    emailAtCount !== 1 ||
    /\s/.test(payload.email) ||
    payload.message.length < 10 ||
    payload.message.length > 2800 ||
    payload.website.length !== 0 ||
    payload.turnstileToken.length < 1 ||
    payload.turnstileToken.length > 2048
  ) {
    return null;
  }

  return payload;
}

async function verifyTurnstile(
  fetchImpl: FetchImplementation,
  request: Request,
  payload: ContactPayload,
  env: Env,
): Promise<"verified" | "failed" | "unavailable"> {
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: payload.turnstileToken,
  });
  const connectingIp = request.headers.get("CF-Connecting-IP");
  if (connectingIp) {
    body.set("remoteip", connectingIp);
  }

  let response: Response;
  try {
    response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return "unavailable";
  }

  if (!response.ok) {
    return "unavailable";
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    return "unavailable";
  }

  if (!isPlainObject(result)) {
    return "unavailable";
  }

  if (
    result.success !== true ||
    result.action !== "contact" ||
    result.hostname !== env.TURNSTILE_HOSTNAME
  ) {
    return "failed";
  }

  return "verified";
}

function slackPlainText(text: string) {
  return { type: "plain_text", text } as const;
}

async function deliverToSlack(
  fetchImpl: FetchImplementation,
  payload: ContactPayload,
  env: Env,
): Promise<boolean> {
  const slackPayload = {
    text: "New Precursor Labs website contact",
    blocks: [
      {
        type: "section",
        text: slackPlainText(`Name: ${payload.name}`),
      },
      {
        type: "section",
        text: slackPlainText(`Email: ${payload.email}`),
      },
      {
        type: "section",
        text: slackPlainText(`Message: ${payload.message}`),
      },
    ],
  };

  try {
    const response = await fetchImpl(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function createContactHandler(fetchImpl: FetchImplementation) {
  return async function contactHandler(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (
      !origin ||
      (origin !== env.ALLOWED_ORIGIN && !LOCAL_ORIGINS.has(origin))
    ) {
      return errorResponse("origin_not_allowed", 403);
    }

    if (new URL(request.url).pathname !== "/contact") {
      return errorResponse("method_not_allowed", 405, origin);
    }

    if (request.method === "OPTIONS") {
      return preflightResponse(origin);
    }

    if (request.method !== "POST") {
      return errorResponse("method_not_allowed", 405, origin);
    }

    const contentType = request.headers.get("Content-Type");
    if (contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      return errorResponse("unsupported_media_type", 415, origin);
    }

    const contentLength = request.headers.get("Content-Length");
    if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
      return errorResponse("request_too_large", 413, origin);
    }

    let rawBody: ArrayBuffer;
    try {
      rawBody = await request.arrayBuffer();
    } catch {
      return errorResponse("invalid_request", 400, origin);
    }

    if (rawBody.byteLength > MAX_BODY_BYTES) {
      return errorResponse("request_too_large", 413, origin);
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return errorResponse("invalid_request", 400, origin);
    }

    if (
      isPlainObject(parsedBody) &&
      typeof parsedBody.website === "string" &&
      parsedBody.website.trim().length > 0
    ) {
      return errorResponse("verification_failed", 403, origin);
    }

    const payload = validatePayload(parsedBody);
    if (!payload) {
      return errorResponse("invalid_request", 400, origin);
    }

    const verification = await verifyTurnstile(fetchImpl, request, payload, env);
    if (verification === "unavailable") {
      return errorResponse("verification_unavailable", 503, origin);
    }
    if (verification === "failed") {
      return errorResponse("verification_failed", 403, origin);
    }

    if (!(await deliverToSlack(fetchImpl, payload, env))) {
      return errorResponse("delivery_failed", 502, origin);
    }

    return jsonResponse({ ok: true }, 200, origin);
  };
}

const contactHandler = createContactHandler(fetch);

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return contactHandler(request, env);
  },
};
