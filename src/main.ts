import "./styles.css";
import "./terminal-stack.css";
import { trackMixpanelEvent } from "./analytics.ts";
import { startAnimatedBackground } from "./animated-background.ts";

const linkNamePattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

trackMixpanelEvent("page_viewed", {
  page_path: window.location.pathname,
  platform: "web",
});

const backgroundField = document.querySelector<HTMLElement>(".ascii-background");

if (backgroundField) {
  const stopAnimatedBackground = startAnimatedBackground(backgroundField);
  window.addEventListener("pagehide", stopAnimatedBackground, { once: true });
}

document.querySelectorAll<HTMLAnchorElement>("a[data-track-link-name]").forEach((link) => {
  link.addEventListener("click", () => {
    const linkName = link.dataset.trackLinkName;
    const linkCategory = link.dataset.trackLinkCategory;

    if (
      !linkName ||
      !linkNamePattern.test(linkName) ||
      (linkCategory !== "backer" && linkCategory !== "experience")
    ) {
      return;
    }

    trackMixpanelEvent("outbound_link_clicked", {
      link_name: linkName,
      link_category: linkCategory,
      is_primary: false,
    });
  });
});
