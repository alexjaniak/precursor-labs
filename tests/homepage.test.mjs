import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("src/styles.css");
const main = read("src/main.ts");
const analytics = read("src/analytics.ts");
const agents = read("AGENTS.md");

test("renders the approved command transcript and removes old controls", () => {
  const commands = [
    "precursor about",
    "precursor thesis",
    "precursor research",
    "precursor interests",
    "precursor backers",
    "precursor experience",
  ];

  for (const command of commands) {
    assert.match(html, new RegExp(command));
  }

  const commandOffsets = commands.map((command) => html.indexOf(command));
  assert.deepEqual(commandOffsets, [...commandOffsets].sort((a, b) => a - b));

  for (const text of [
    "Precursor Labs is a research company studying the organizing principles",
    "We believe the next generation of autonomous systems",
    "We are engineers, financiers, and company builders",
    "We are especially interested in partners working on interactive learning",
  ]) {
    assert.match(html, new RegExp(text));
  }

  assert.doesNotMatch(html, /themeToggle|logoMark|logoAnimation|header-social/);
  assert.match(html, /<meta name="theme-color" content="#FAFAFA" \/>/);
  assert.match(html, /class="final-prompt"[^>]*aria-hidden="true"/);
});

test("keeps the approved credibility destinations", () => {
  for (const destination of [
    "https://www.blockchaincapital.com/",
    "https://reforge.vc/",
    "https://www.blockchainbuilders.fund/",
    "https://aws.amazon.com/",
    "https://www.stanford.edu/",
    "https://www.northropgrumman.com/",
    "https://duke.edu/",
    "https://www.centerviewpartners.com/",
    "https://www.berkeley.edu/",
    "https://www.cornell.edu/",
    "https://www.harvard.edu/",
  ]) {
    const anchor = html
      .match(/<a\b[\s\S]*?<\/a\s*>/g)
      ?.find((candidate) => candidate.includes(`href="${destination}"`));
    assert.ok(anchor, `missing link for ${destination}`);
    assert.match(anchor, /rel="noreferrer"/);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /data-track-link-name="[a-z_]+"/);
    assert.match(anchor, /data-track-link-category="(?:backer|experience)"/);
  }
});

test("uses the approved visual system and responsive terminal", () => {
  for (const token of ["#FAFAFA", "#171717", "#71716B", "#659F58", "#E5E5E3"]) {
    assert.match(css, new RegExp(token, "i"));
  }
  assert.match(css, /IBM Plex Mono/);
  assert.match(css, /@fontsource\/ibm-plex-mono\/latin-400\.css/);
  assert.match(css, /@fontsource\/ibm-plex-mono\/latin-500\.css/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /scrollbar-color:\s*var\(--muted\)\s+var\(--paper\)/);
  const webkitThumbRule = css.match(/\.terminal-body::-webkit-scrollbar-thumb\s*\{([^}]*)\}/);
  assert.ok(webkitThumbRule, "missing default WebKit scrollbar thumb rule");
  assert.match(webkitThumbRule[1], /background:\s*var\(--muted\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /step-end/);
  assert.doesNotMatch(css, /box-shadow|linear-gradient|radial-gradient/);
});

test("uses a compact macOS terminal frame", () => {
  const controls = html.match(/<div class="window-controls" aria-hidden="true">([\s\S]*?)<\/div>/);
  assert.ok(controls, "missing decorative macOS window controls");
  assert.match(controls[1], /class="window-control window-control-close"/);
  assert.match(controls[1], /class="window-control window-control-minimize"/);
  assert.match(controls[1], /class="window-control window-control-zoom"/);
  assert.doesNotMatch(controls[1], /<(?:a|button|input|select|textarea)\b|tabindex=/);
  assert.match(html, /PRECURSOR_LABS\s+—\s+zsh/);

  assert.match(css, /width:\s*min\(680px,\s*calc\(100vw - 40px\)\)/);
  assert.match(css, /height:\s*clamp\(600px,\s*78svh,\s*760px\)/);
  assert.match(css, /border-radius:\s*0/);
  assert.match(css, /grid-template-columns:\s*1fr\s+auto\s+1fr/);
  assert.match(css, /min-height:\s*36px/);
  assert.match(css, /background:\s*#F3F3F1/i);
  assert.match(css, /gap:\s*8px/);
  assert.match(css, /width:\s*10px/);
  assert.match(css, /height:\s*10px/);
  assert.match(css, /#DF6A60/i);
  assert.match(css, /#D9A441/i);
  assert.match(css, /@media\s*\(max-width:\s*420px\)/);
  assert.match(css, /\.terminal-session\s*\{[^}]*display:\s*none/s);
});

test("renders backers and experience as inline separated rows that wrap", () => {
  assert.equal((html.match(/class="output terminal-list terminal-list-inline"/g) ?? []).length, 2);
  assert.match(css, /\.terminal-list-inline\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.terminal-list-inline\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.terminal-list-inline\s*\{[^}]*font-size:\s*13px/s);
  assert.match(css, /\.terminal-list-inline\s*\{[^}]*white-space:\s*normal/s);
  assert.match(css, /\.terminal-list-inline li \+ li::before\s*\{[^}]*content:\s*" \/ "/s);
});

test("keeps only the approved analytics contract", () => {
  assert.match(main, /page_viewed/);
  assert.match(main, /outbound_link_clicked/);
  assert.doesNotMatch(main, /theme_toggled|logo_animation_started/);
  assert.doesNotMatch(analytics, /theme_toggled|logo_animation_started/);
  assert.match(analytics, /"backer"\s*\|\s*"experience"/);
  assert.match(analytics, /is_primary:\s*false/);
  assert.match(agents, /does not define an Initial Value Moment/i);

  assert.match(
    main,
    /const\s+linkNamePattern\s*=\s*\/\^\[a-z0-9\]\+\(\?:_\[a-z0-9\]\+\)\*\$\//,
  );
  const linkNameGuardOffset = main.indexOf("!linkNamePattern.test(linkName)");
  const outboundTrackingOffset = main.indexOf('trackMixpanelEvent("outbound_link_clicked"');
  assert.ok(linkNameGuardOffset >= 0, "missing snake_case link-name guard");
  assert.ok(
    linkNameGuardOffset < outboundTrackingOffset,
    "link-name guard must run before outbound tracking",
  );
});
