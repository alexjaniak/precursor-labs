import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("src/styles.css");
const main = read("src/main.ts");
const viteEnv = read("src/vite-env.d.ts");
const controllerUrl = new URL("../src/contact-form.ts", import.meta.url);

const loadController = async () => {
  assert.ok(existsSync(controllerUrl), "missing contact form controller");
  return import(controllerUrl.href);
};

const getSessionFour = () => {
  const start = html.indexOf('<article\n            class="terminal terminal-card"\n            data-card-id="session-04"');
  assert.ok(start >= 0, "missing session 04 card");
  const end = html.indexOf("</article>", start);
  assert.ok(end > start, "missing session 04 closing tag");
  return html.slice(start, end + "</article>".length);
};

const getAttribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2];
};

class FakeControl extends EventTarget {
  constructor(value = "") {
    super();
    this.value = value;
    this.disabled = false;
    this.dataset = {};
  }
}

class FakeForm extends EventTarget {
  constructor() {
    super();
    this.valid = true;
    this.controls = {
      "[data-contact-name]": new FakeControl("  Ada Lovelace  "),
      "[data-contact-email]": new FakeControl("  ada@example.com  "),
      "[data-contact-message]": new FakeControl("  A detailed contact message.  "),
      "[data-contact-website]": new FakeControl(""),
      "[data-contact-turnstile]": new FakeControl(),
      "[data-contact-submit]": new FakeControl(),
      "[data-contact-status]": new FakeControl(),
    };
  }

  querySelector(selector) {
    return this.controls[selector] ?? null;
  }

  checkValidity() {
    return this.valid;
  }

  reportValidity() {
    this.reported = true;
    return this.valid;
  }

  input() {
    this.dispatchEvent(new Event("input"));
  }

  submit() {
    this.dispatchEvent(new Event("submit", { cancelable: true }));
  }
}

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const makeHarness = async ({ response, fetchError, valid = true } = {}) => {
  const form = new FakeForm();
  form.valid = valid;
  const renderCalls = [];
  const resetCalls = [];
  const removeCalls = [];
  const fetchCalls = [];
  let loaderCleanups = 0;
  const api = {
    render(container, options) {
      renderCalls.push([container, options]);
      return "widget-04";
    },
    reset(widgetId) {
      resetCalls.push(widgetId);
    },
    remove(widgetId) {
      removeCalls.push(widgetId);
    },
  };
  const fetchImpl = async (...args) => {
    fetchCalls.push(args);
    if (fetchError) throw fetchError;
    return response ?? {
      ok: true,
      async json() {
        return { ok: true };
      },
    };
  };
  const { startContactForm } = await loadController();
  const cleanup = startContactForm(form, {
    endpoint: "https://contact.example.test/contact",
    siteKey: "site-key",
    fetchImpl,
    turnstileLoader: {
      async load() {
        return api;
      },
      cleanup() {
        loaderCleanups += 1;
      },
    },
  });
  await settle();
  assert.equal(renderCalls.length, 1);
  return {
    api,
    cleanup,
    fetchCalls,
    form,
    get loaderCleanups() {
      return loaderCleanups;
    },
    removeCalls,
    renderCalls,
    resetCalls,
  };
};

test("renders the terminal contact form with the exact accessible field contract", () => {
  const card = getSessionFour();
  const titleButton = card.match(/<button\b[^>]*class="terminal-header terminal-card-trigger"[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(titleButton, "missing session 04 title button");
  assert.doesNotMatch(titleButton, /<(?:form|input|textarea|label)\b/i);

  const formTag = card.match(/<form\b[^>]*data-contact-form[^>]*>/)?.[0];
  assert.ok(formTag, "missing semantic contact form");
  assert.equal(getAttribute(formTag, "class"), "terminal-contact-form");
  assert.match(card, /<span class="prompt" aria-hidden="true">\$<\/span><span>contact --new<\/span>/);

  const controls = Object.fromEntries(
    [...card.matchAll(/<(input|textarea)\b[^>]*name="(name|email|message|website)"[^>]*>/g)].map(
      ([tag, , name]) => [name, tag],
    ),
  );
  assert.deepEqual(Object.keys(controls).sort(), ["email", "message", "name", "website"]);

  assert.equal(getAttribute(controls.name, "type"), "text");
  assert.equal(getAttribute(controls.name, "minlength"), "2");
  assert.equal(getAttribute(controls.name, "maxlength"), "100");
  assert.equal(getAttribute(controls.name, "autocomplete"), "name");
  assert.match(controls.name, /\srequired(?:\s|>)/);

  assert.equal(getAttribute(controls.email, "type"), "email");
  assert.equal(getAttribute(controls.email, "minlength"), "5");
  assert.equal(getAttribute(controls.email, "maxlength"), "254");
  assert.equal(getAttribute(controls.email, "autocomplete"), "email");
  assert.match(controls.email, /\srequired(?:\s|>)/);

  assert.equal(getAttribute(controls.message, "minlength"), "10");
  assert.equal(getAttribute(controls.message, "maxlength"), "2800");
  assert.match(controls.message, /\srequired(?:\s|>)/);

  assert.equal(getAttribute(controls.website, "type"), "text");
  assert.equal(getAttribute(controls.website, "tabindex"), "-1");
  assert.equal(getAttribute(controls.website, "autocomplete"), "off");
  assert.match(card, /<div\b[^>]*class="contact-honeypot"[^>]*aria-hidden="true"[^>]*>[\s\S]*name="website"/);

  for (const [name, id] of [
    ["name", "contact-name"],
    ["email", "contact-email"],
    ["message", "contact-message"],
  ]) {
    assert.equal(getAttribute(controls[name], "id"), id);
    assert.match(card, new RegExp(`<label\\b[^>]*for="${id}"[^>]*>${name}<\\/label>`));
  }

  assert.match(card, /<div\b[^>]*data-contact-turnstile[^>]*><\/div>/);
  assert.match(card, /<button\b(?=[^>]*data-contact-submit)(?=[^>]*type="submit")(?=[^>]*disabled)[^>]*>send_message<\/button>/);
  assert.match(card, /<p\b(?=[^>]*data-contact-status)(?=[^>]*aria-live="polite")(?=[^>]*role="status")[^>]*><\/p>/);
});

test("keeps contact styling compact, square, flat, and within the approved color rules", () => {
  assert.match(css, /\.terminal-contact-form\s*\{[^}]*display:\s*grid[^}]*gap:\s*(?:12|16)px/s);
  assert.match(css, /\.contact-field\s+label\s*\{[^}]*color:\s*var\(--muted\)[^}]*font-size:\s*(?:10|11)px[^}]*text-transform:\s*uppercase/s);
  assert.match(css, /\.contact-field\s+(?:input|input,\s*\.contact-field\s+textarea)[^{]*\{[^}]*border:\s*1px solid var\(--line\)[^}]*border-radius:\s*0[^}]*font:\s*inherit/s);
  assert.match(css, /\.contact-field input:focus-visible,\s*\.contact-field textarea:focus-visible\s*\{[^}]*border-color:\s*var\(--accent\)/s);
  assert.match(css, /\.contact-submit\s*\{[^}]*border:\s*1px solid var\(--accent\)[^}]*border-radius:\s*0[^}]*color:\s*var\(--accent\)/s);
  assert.match(css, /\.contact-submit:disabled\s*\{[^}]*border-color:\s*var\(--line\)[^}]*color:\s*var\(--muted\)/s);
  assert.match(css, /\.contact-status\[data-state="success"\]\s*\{[^}]*color:\s*var\(--accent\)/s);
  assert.doesNotMatch(css, /\.terminal-contact-form[\s\S]{0,800}(?:box-shadow|gradient)/);
  for (const duration of css.matchAll(/\.contact[^}]*\{[^}]*transition:[^;]*?(\d+)ms/gs)) {
    assert.ok(Number(duration[1]) <= 150, "contact transitions must not exceed 150ms");
  }
});

test("declares public contact configuration and starts one controller without analytics", () => {
  assert.match(viteEnv, /readonly VITE_CONTACT_ENDPOINT\?: string/);
  assert.match(viteEnv, /readonly VITE_TURNSTILE_SITE_KEY\?: string/);
  assert.match(main, /import \{ startContactForm \} from "\.\/contact-form\.ts"/);
  assert.match(main, /querySelector<HTMLFormElement>\("\[data-contact-form\]"\)/);
  assert.match(main, /startContactForm\(contactForm\)/);
  assert.match(main, /window\.addEventListener\("pagehide",\s*stopContactForm,\s*\{ once:\s*true \}\)/);
  const contactStart = main.indexOf("startContactForm(contactForm)");
  assert.ok(contactStart >= 0);
  assert.doesNotMatch(main.slice(contactStart - 200, contactStart + 300), /trackMixpanelEvent|mixpanel/i);
});

test("keeps the visible form unavailable and does not load Turnstile without both settings", async () => {
  const { startContactForm } = await loadController();
  for (const config of [
    { endpoint: undefined, siteKey: "site-key" },
    { endpoint: "https://contact.example.test/contact", siteKey: undefined },
  ]) {
    const form = new FakeForm();
    let loads = 0;
    const cleanup = startContactForm(form, {
      ...config,
      turnstileLoader: {
        async load() {
          loads += 1;
          throw new Error("must not load");
        },
        cleanup() {},
      },
    });
    assert.equal(form.controls["[data-contact-submit]"].disabled, true);
    assert.equal(form.controls["[data-contact-status]"].textContent, "contact_channel_unavailable");
    assert.equal(loads, 0);
    cleanup();
  }
});

test("renders a flexible light contact widget and enables submit only for valid native fields", async () => {
  const harness = await makeHarness();
  const [, options] = harness.renderCalls[0];
  assert.equal(options.sitekey, "site-key");
  assert.equal(options.theme, "light");
  assert.equal(options.size, "flexible");
  assert.equal(options.action, "contact");
  assert.equal(harness.form.controls["[data-contact-submit]"].disabled, true);

  options.callback("verified-token");
  assert.equal(harness.form.controls["[data-contact-submit]"].disabled, false);

  harness.form.valid = false;
  harness.form.input();
  assert.equal(harness.form.controls["[data-contact-submit]"].disabled, true);
  harness.form.submit();
  await settle();
  assert.equal(harness.fetchCalls.length, 0);
  assert.equal(harness.form.reported, true);
  harness.cleanup();
});

test("posts only trimmed contact fields and resets the one-use token after success", async () => {
  const harness = await makeHarness();
  const options = harness.renderCalls[0][1];
  options.callback("verified-token");
  harness.form.submit();
  assert.equal(harness.form.controls["[data-contact-submit]"].disabled, true);
  assert.equal(harness.form.controls["[data-contact-status]"].textContent, "sending...");
  await settle();

  assert.equal(harness.fetchCalls.length, 1);
  const [url, init] = harness.fetchCalls[0];
  assert.equal(url, "https://contact.example.test/contact");
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, { "Content-Type": "application/json" });
  assert.deepEqual(JSON.parse(init.body), {
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "A detailed contact message.",
    website: "",
    turnstileToken: "verified-token",
  });
  assert.equal(harness.form.controls["[data-contact-name]"].value, "  Ada Lovelace  ");
  assert.equal(harness.form.controls["[data-contact-email]"].value, "  ada@example.com  ");
  assert.equal(harness.form.controls["[data-contact-message]"].value, "");
  assert.equal(harness.form.controls["[data-contact-status]"].textContent, "message_sent");
  assert.equal(harness.form.controls["[data-contact-status]"].dataset.state, "success");
  assert.equal(harness.form.controls["[data-contact-submit]"].disabled, true);
  assert.deepEqual(harness.resetCalls, ["widget-04"]);
  harness.cleanup();
});

test("blocks double submit while a contact request is active", async () => {
  let resolveFetch;
  const responsePromise = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  const harness = await makeHarness({ response: await Promise.resolve(undefined) });
  harness.fetchCalls.length = 0;

  const pendingCalls = [];
  const { startContactForm } = await loadController();
  harness.cleanup();
  const form = new FakeForm();
  const renderCalls = [];
  startContactForm(form, {
    endpoint: "https://contact.example.test/contact",
    siteKey: "site-key",
    fetchImpl(...args) {
      pendingCalls.push(args);
      return responsePromise;
    },
    turnstileLoader: {
      async load() {
        return {
          render(_mount, options) {
            renderCalls.push(options);
            return "widget-pending";
          },
          reset() {},
          remove() {},
        };
      },
      cleanup() {},
    },
  });
  await settle();
  renderCalls[0].callback("token");
  form.submit();
  form.submit();
  assert.equal(pendingCalls.length, 1);
  resolveFetch({ ok: true, async json() { return { ok: true }; } });
  await settle();
});

test("preserves all values and uses one retry status for every delivery failure", async () => {
  const cases = [
    { response: { ok: false, async json() { return { ok: false }; } } },
    { response: { ok: true, async json() { return { unexpected: true }; } } },
    { response: { ok: true, async json() { throw new Error("invalid JSON"); } } },
    { fetchError: new Error("network failure") },
  ];

  for (const failure of cases) {
    const harness = await makeHarness(failure);
    harness.renderCalls[0][1].callback("one-use-token");
    harness.form.submit();
    await settle();
    assert.equal(harness.form.controls["[data-contact-name]"].value, "  Ada Lovelace  ");
    assert.equal(harness.form.controls["[data-contact-email]"].value, "  ada@example.com  ");
    assert.equal(harness.form.controls["[data-contact-message]"].value, "  A detailed contact message.  ");
    assert.equal(harness.form.controls["[data-contact-status]"].textContent, "message_failed_try_again");
    assert.equal(harness.form.controls["[data-contact-status]"].dataset.state, "error");
    assert.equal(harness.form.controls["[data-contact-submit]"].disabled, true);
    assert.deepEqual(harness.resetCalls, ["widget-04"]);
    harness.cleanup();
  }
});

test("clears and resets tokens after widget errors, expiry, and timeout", async () => {
  for (const callbackName of ["error-callback", "expired-callback", "timeout-callback"]) {
    const harness = await makeHarness();
    const options = harness.renderCalls[0][1];
    options.callback("temporary-token");
    assert.equal(harness.form.controls["[data-contact-submit]"].disabled, false);
    options[callbackName]();
    assert.equal(harness.form.controls["[data-contact-submit]"].disabled, true);
    assert.deepEqual(harness.resetCalls, ["widget-04"]);
    harness.form.submit();
    await settle();
    assert.equal(harness.fetchCalls.length, 0);
    harness.cleanup();
  }
});

test("cleans up listeners, widget, token, and loader exactly once", async () => {
  const harness = await makeHarness();
  harness.renderCalls[0][1].callback("token-before-cleanup");
  harness.cleanup();
  harness.cleanup();
  assert.deepEqual(harness.resetCalls, ["widget-04"]);
  assert.deepEqual(harness.removeCalls, ["widget-04"]);
  assert.equal(harness.loaderCleanups, 1);
  harness.form.submit();
  harness.form.input();
  await settle();
  assert.equal(harness.fetchCalls.length, 0);
});
