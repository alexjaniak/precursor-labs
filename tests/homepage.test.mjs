import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("src/styles.css");
const main = read("src/main.ts");
const analytics = read("src/analytics.ts");
const agents = read("AGENTS.md");

test("renders the approved command transcript and removes old controls", () => {
  const expectedCommands = [
    "about",
    "thesis",
    "research and interests",
    "backers",
    "team experience",
  ];
  const expectedParagraphs = [
    "Precursor Labs is a research company studying the organizing principles and infrastructure for collective intelligence.",
    "We believe the next generation of autonomous systems will need to coordinate with humans and agents, reason in dynamic environments, and allocate resources under uncertainty.",
    "We are engineers, financiers, and company builders focusing on multi-agent systems in dynamic social environments, as well as resource scheduling and memory management for latency-constrained inference serving.",
    "We are especially interested in partners working on interactive learning, multi-agent RL, KV cache allocation, and scheduling.",
  ];
  const transcriptEntries =
    html.match(/<section class="transcript-entry">[\s\S]*?<\/section>/g) ?? [];

  assert.equal(transcriptEntries.length, 5);

  const commands = transcriptEntries.map((entry) => {
    const command = entry.match(
      /<p class="command"><span class="prompt" aria-hidden="true">\$<\/span><span>([^<]+)<\/span><\/p>/,
    );
    assert.ok(command, "missing command span");
    return command[1];
  });

  assert.deepEqual(commands, expectedCommands);

  for (const command of commands) {
    assert.doesNotMatch(command, /\bprecursor\b/i);
  }

  const bodyParagraphs = [...html.matchAll(/<p class="output">([^<]+)<\/p>/g)].map(
    ([, paragraph]) => paragraph,
  );
  assert.deepEqual(bodyParagraphs, expectedParagraphs);

  const researchEntry = transcriptEntries.find((entry) =>
    entry.includes("<span>research and interests</span>"),
  );
  assert.ok(researchEntry, "missing combined research and interests entry");
  const researchParagraphs = [
    ...researchEntry.matchAll(/<p class="output">([^<]+)<\/p>/g),
  ].map(([, paragraph]) => paragraph);
  assert.deepEqual(researchParagraphs, expectedParagraphs.slice(2));

  assert.doesNotMatch(html, /themeToggle|logoMark|logoAnimation|header-social/);
  assert.match(html, /<meta name="theme-color" content="#FAFAFA" \/>/);
  assert.match(html, /class="final-prompt"[^>]*aria-hidden="true"/);
});

test("keeps the approved credibility destinations", () => {
  const expectedLinks = [
    ["Blockchain Capital", "https://www.blockchaincapital.com/", "blockchain_capital", "backer"],
    ["Reforge", "https://reforge.vc/", "reforge", "backer"],
    [
      "Blockchain Builders Fund",
      "https://www.blockchainbuilders.fund/",
      "blockchain_builders_fund",
      "backer",
    ],
    ["AWS", "https://aws.amazon.com/", "aws", "experience"],
    ["Stanford", "https://www.stanford.edu/", "stanford", "experience"],
    [
      "Northrop Grumman RL",
      "https://www.northropgrumman.com/",
      "northrop_grumman_rl",
      "experience",
    ],
    ["Duke", "https://duke.edu/", "duke", "experience"],
    [
      "Centerview Partners",
      "https://www.centerviewpartners.com/",
      "centerview_partners",
      "experience",
    ],
    ["Berkeley", "https://www.berkeley.edu/", "berkeley", "experience"],
    ["Cornell", "https://www.cornell.edu/", "cornell", "experience"],
    ["Harvard", "https://www.harvard.edu/", "harvard", "experience"],
  ];

  for (const [label, destination, trackingName, trackingCategory] of expectedLinks) {
    const anchor = html
      .match(/<a\b[\s\S]*?<\/a\s*>/g)
      ?.find((candidate) => candidate.includes(`href="${destination}"`));
    assert.ok(anchor, `missing link for ${destination}`);
    assert.match(anchor, /rel="noreferrer"/);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, new RegExp(`data-track-link-name="${trackingName}"`));
    assert.match(anchor, new RegExp(`data-track-link-category="${trackingCategory}"`));
    assert.equal(anchor.replace(/<[^>]+>/g, "").trim(), label);
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
  const responsiveTerminalRule = css.match(
    /@media\s*\(max-width:\s*600px\),\s*\(max-height:\s*560px\)\s*\{[\s\S]*?\.terminal\s*\{([^}]*)\}/,
  );
  assert.ok(responsiveTerminalRule, "missing responsive terminal rule");
  assert.match(responsiveTerminalRule[1], /width:\s*calc\(100vw - 24px\)/);
  assert.match(responsiveTerminalRule[1], /height:\s*calc\(100svh - 12px\)/);
});

test("uses a compact macOS terminal frame", () => {
  const controls = html.match(/<div class="window-controls" aria-hidden="true">([\s\S]*?)<\/div>/);
  assert.ok(controls, "missing decorative macOS window controls");
  assert.match(controls[1], /class="window-control window-control-close"/);
  assert.match(controls[1], /class="window-control window-control-minimize"/);
  assert.match(controls[1], /class="window-control window-control-zoom"/);
  assert.doesNotMatch(controls[1], /<(?:a|button|input|select|textarea)\b|tabindex=/);
  assert.match(html, /PRECURSOR_LABS\s+—\s+zsh/);

  assert.match(css, /width:\s*min\(560px,\s*calc\(100vw - 40px\)\)/);
  assert.match(css, /height:\s*clamp\(600px,\s*78svh,\s*760px\)/);
  assert.match(
    css,
    /\.terminal\s*\{(?=[^}]*overflow:\s*hidden)(?=[^}]*border-radius:\s*8px)[^}]*\}/,
  );
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

test("renders the Innies animated ASCII field behind the solid terminal", () => {
  const backgroundPath = new URL("../src/animated-background.ts", import.meta.url);

  assert.match(html, /<div class="ascii-background" aria-hidden="true"><\/div>/);
  assert.ok(existsSync(backgroundPath), "missing animated background module");

  const background = readFileSync(backgroundPath, "utf8");
  const revealImport = background.match(
    /import\s+\{([^}]*)\}\s+from\s+"\.\/ascii-reveal\.ts"/s,
  );
  assert.match(main, /import\s+\{\s*startAnimatedBackground\s*\}\s+from\s+"\.\/animated-background\.ts"/);
  assert.match(main, /startAnimatedBackground\(backgroundField\)/);
  assert.ok(revealImport, "missing ASCII reveal helper import");
  assert.match(revealImport[1], /\bisBrandLaunch\b/);
  assert.match(revealImport[1], /\bstartBrandRevealTimeline\b/);
  assert.match(background, /\bisBrandLaunch\(/);
  assert.match(background, /\bstartBrandRevealTimeline\(/);
  assert.match(background, /\$#%:;\+=\/\\\\\[\]\{\}\*~\?01<>\^!-@&/);
  assert.match(background, /textContent/);
  assert.match(background, /setInterval/);
  assert.match(background, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(background, /fillRect|canvas|getContext/);

  assert.match(css, /\.ascii-background\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.ascii-background-row\s*\{[^}]*color:\s*rgb\(113 113 107 \/ 8%\)[^}]*white-space:\s*pre/s);
  assert.match(css, /\.terminal\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1[^}]*background:\s*var\(--paper\)/s);
  assert.match(css, /\.terminal-body\s*\{[^}]*background:\s*var\(--paper\)/s);
});

test("uses 25% green for active ASCII scramble segments", () => {
  assert.match(css, /\.ascii-background-segment\s*\{[^}]*color:\s*rgb\(101 159 88 \/ 25%\)/s);
});

test("uses 50% green for PRECURSOR and fades it to the row color over 400 ms", () => {
  assert.match(css, /\.ascii-background-brand\s*\{[^}]*color:\s*rgb\(101 159 88 \/ 50%\)/s);
  assert.match(
    css,
    /\.ascii-background-brand-fade\s*\{[^}]*animation:\s*precursor-brand-fade 400ms ease-out forwards/s,
  );
  assert.match(
    css,
    /@keyframes\s+precursor-brand-fade\s*\{\s*from\s*\{[^}]*color:\s*rgb\(101 159 88 \/ 50%\)[^}]*\}\s*to\s*\{[^}]*color:\s*rgb\(113 113 107 \/ 8%\)[^}]*\}\s*\}/s,
  );
});

test("persists PRECURSOR while preserving ordinary segment completion", () => {
  const background = read("src/animated-background.ts");

  assert.match(
    background,
    /const\s+finishSegment\s*=\s*\(\s*segment:\s*ActiveSegment,\s*replacementText\s*=\s*segment\.finalText,?\s*\)\s*=>/s,
  );
  assert.match(
    background,
    /replaceRange\(\s*row,\s*segment\.start,\s*segment\.length,\s*replacementText,?\s*\)/s,
  );
  assert.match(
    background,
    /\(completionText\)\s*=>\s*finishSegment\(segment,\s*completionText\)/s,
  );
  assert.match(background, /\bisBrandFading:\s*boolean/);
  assert.match(
    background,
    /segment\.isBrandFading\s*\?\s*"ascii-background-segment ascii-background-brand-fade"\s*:\s*segment\.isBrandVisible\s*\?\s*"ascii-background-segment ascii-background-brand"/s,
  );
  assert.match(
    background,
    /segment\.text\s*=\s*text;\s*segment\.isBrandVisible\s*=\s*true;\s*segment\.isBrandFading\s*=\s*false;\s*renderRow\(segment\.rowIndex\);/s,
  );
  assert.match(
    background,
    /\(text\)\s*=>\s*\{.*?segment\.text\s*=\s*text;\s*segment\.isBrandVisible\s*=\s*false;\s*segment\.isBrandFading\s*=\s*true;\s*renderRow\(segment\.rowIndex\);\s*\},\s*\(completionText\)\s*=>\s*finishSegment\(segment,\s*completionText\)/s,
  );
  assert.match(
    background,
    /if\s*\(\s*!brandReveal\s*&&\s*Date\.now\(\)\s*>=\s*endAt\s*\)\s*\{\s*finishSegment\(segment\);\s*return;/s,
  );
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
