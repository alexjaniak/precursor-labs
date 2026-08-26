type WidgetId = string | number;

type TurnstileRenderOptions = {
  sitekey: string;
  theme: "light";
  size: "flexible";
  action: "contact";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
};

export type TurnstileApi = {
  render(container: HTMLElement, options: TurnstileRenderOptions): WidgetId;
  reset(widgetId: WidgetId): void;
  remove(widgetId: WidgetId): void;
};

export type TurnstileLoader = {
  load(): Promise<TurnstileApi>;
  cleanup(): void;
};

type ContactDependencies = {
  endpoint?: string;
  siteKey?: string;
  fetchImpl?: typeof fetch;
  turnstileLoader?: TurnstileLoader;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const INVALID_FIELD_MESSAGE = "Check this value.";

function createTurnstileLoader(): TurnstileLoader {
  let script: HTMLScriptElement | null = null;
  let promise: Promise<TurnstileApi> | null = null;
  let rejectPending: ((reason?: unknown) => void) | null = null;
  let onLoad: (() => void) | null = null;
  let onError: (() => void) | null = null;

  const removeScriptListeners = () => {
    if (!script) return;
    if (onLoad) script.removeEventListener("load", onLoad);
    if (onError) script.removeEventListener("error", onError);
    onLoad = null;
    onError = null;
  };

  return {
    load() {
      if (window.turnstile) return Promise.resolve(window.turnstile);
      if (promise) return promise;

      promise = new Promise<TurnstileApi>((resolve, reject) => {
        rejectPending = reject;
        script = document.createElement("script");
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        onLoad = () => {
          removeScriptListeners();
          rejectPending = null;
          if (window.turnstile) {
            resolve(window.turnstile);
          } else {
            reject(new Error("Turnstile did not initialize."));
          }
        };
        onError = () => {
          removeScriptListeners();
          rejectPending = null;
          reject(new Error("Turnstile failed to load."));
        };
        script.addEventListener("load", onLoad);
        script.addEventListener("error", onError);
        document.head.append(script);
      });

      return promise;
    },
    cleanup() {
      removeScriptListeners();
      rejectPending?.(new Error("Turnstile loading was cancelled."));
      rejectPending = null;
      script?.remove();
      script = null;
    },
  };
}

function requiredElement<ElementType extends Element>(
  form: HTMLFormElement,
  selector: string,
): ElementType {
  const element = form.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Missing contact form element: ${selector}`);
  return element;
}

export function startContactForm(
  form: HTMLFormElement,
  dependencies: ContactDependencies = {},
): () => void {
  const name = requiredElement<HTMLInputElement>(form, "[data-contact-name]");
  const email = requiredElement<HTMLInputElement>(form, "[data-contact-email]");
  const message = requiredElement<HTMLTextAreaElement>(form, "[data-contact-message]");
  const website = requiredElement<HTMLInputElement>(form, "[data-contact-website]");
  const turnstileMount = requiredElement<HTMLElement>(form, "[data-contact-turnstile]");
  const submit = requiredElement<HTMLButtonElement>(form, "[data-contact-submit]");
  const status = requiredElement<HTMLElement>(form, "[data-contact-status]");
  const endpoint = (dependencies.endpoint ?? import.meta.env?.VITE_CONTACT_ENDPOINT)?.trim();
  const siteKey = (dependencies.siteKey ?? import.meta.env?.VITE_TURNSTILE_SITE_KEY)?.trim();
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const turnstileLoader = dependencies.turnstileLoader ?? createTurnstileLoader();

  let disposed = false;
  let sending = false;
  let token = "";
  let turnstile: TurnstileApi | null = null;
  let widgetId: WidgetId | null = null;
  let requestController: AbortController | null = null;

  const setStatus = (text: string, state?: "success" | "error") => {
    status.textContent = text;
    if (state) {
      status.dataset.state = state;
    } else {
      delete status.dataset.state;
    }
  };

  const setTrimmedValidity = () => {
    const trimmedName = name.value.trim();
    const trimmedEmail = email.value.trim();
    const trimmedMessage = message.value.trim();
    const emailAtCount = [...trimmedEmail].filter((character) => character === "@").length;

    name.setCustomValidity(
      trimmedName.length >= 2 && trimmedName.length <= 100 ? "" : INVALID_FIELD_MESSAGE,
    );
    email.setCustomValidity(
      trimmedEmail.length >= 5 &&
        trimmedEmail.length <= 254 &&
        emailAtCount === 1 &&
        !/\s/.test(trimmedEmail)
        ? ""
        : INVALID_FIELD_MESSAGE,
    );
    message.setCustomValidity(
      trimmedMessage.length >= 10 && trimmedMessage.length <= 2800
        ? ""
        : INVALID_FIELD_MESSAGE,
    );
  };

  const updateSubmit = () => {
    setTrimmedValidity();
    submit.disabled = disposed || sending || !token || !form.checkValidity();
  };

  const resetVerification = () => {
    token = "";
    updateSubmit();
    if (turnstile && widgetId !== null) turnstile.reset(widgetId);
  };

  const onInput = () => {
    updateSubmit();
  };

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (disposed || sending) return;
    updateSubmit();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!token || !endpoint) {
      updateSubmit();
      return;
    }

    sending = true;
    setStatus("sending...");
    updateSubmit();
    const controller = new AbortController();
    requestController = controller;

    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: name.value.trim(),
          email: email.value.trim(),
          message: message.value.trim(),
          website: website.value,
          turnstileToken: token,
        }),
      });
      const result: unknown = response.ok ? await response.json() : null;
      const delivered =
        typeof result === "object" && result !== null && "ok" in result && result.ok === true;

      if (!response.ok || !delivered) throw new Error("Contact delivery failed.");
      if (!disposed) {
        message.value = "";
        setStatus("message_sent", "success");
      }
    } catch {
      if (!disposed) setStatus("message_failed_try_again", "error");
    } finally {
      if (requestController === controller) requestController = null;
      sending = false;
      if (!disposed) resetVerification();
    }
  };

  submit.disabled = true;
  form.addEventListener("input", onInput);
  form.addEventListener("submit", onSubmit);

  if (!endpoint || !siteKey) {
    setStatus("contact_channel_unavailable", "error");
  } else {
    void turnstileLoader
      .load()
      .then((api) => {
        if (disposed) return;
        turnstile = api;
        widgetId = api.render(turnstileMount, {
          sitekey: siteKey,
          theme: "light",
          size: "flexible",
          action: "contact",
          callback(nextToken) {
            if (disposed) return;
            token = nextToken;
            updateSubmit();
          },
          "error-callback": resetVerification,
          "expired-callback": resetVerification,
          "timeout-callback": resetVerification,
        });
      })
      .catch(() => {
        if (!disposed) setStatus("contact_channel_unavailable", "error");
      });
  }

  return () => {
    if (disposed) return;
    disposed = true;
    form.removeEventListener("input", onInput);
    form.removeEventListener("submit", onSubmit);
    token = "";
    submit.disabled = true;
    requestController?.abort();
    requestController = null;
    if (turnstile && widgetId !== null) {
      turnstile.reset(widgetId);
      turnstile.remove(widgetId);
    }
    turnstileLoader.cleanup();
    turnstile = null;
    widgetId = null;
  };
}
