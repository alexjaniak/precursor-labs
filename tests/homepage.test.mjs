import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("src/styles.css");
const main = read("src/main.ts");
const analytics = read("src/analytics.ts");
const agents = read("AGENTS.md");

const extractElement = (source, tagName, openingPattern, missingMessage) => {
  const opening = openingPattern.exec(source);
  assert.ok(opening, missingMessage);

  const openingStart = opening.index;
  const openingEnd = openingStart + opening[0].length;
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = openingStart;
  let depth = 0;

  for (const tag of source.matchAll(tagPattern)) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (depth === 0) {
      return {
        content: source.slice(openingEnd, tag.index),
        opening: opening[0],
      };
    }
  }

  return assert.fail(`missing closing ${tagName} tag`);
};

test("defines the accessible four-session terminal stack source contract", () => {
  assert.equal((html.match(/data-terminal-stack(?:\s|>)/g) ?? []).length, 1);
  const region = extractElement(
    html,
    "section",
    /<section\b(?=[^>]*data-terminal-stack(?:\s|>))[^>]*>/,
    "missing semantic terminal stack region",
  );
  const regionContent = region.content;

  assert.equal((regionContent.match(/data-stack-stage(?:\s|>)/g) ?? []).length, 1);
  const stage = extractElement(
    regionContent,
    "div",
    /<div\b(?=[^>]*data-stack-stage(?:\s|>))[^>]*>/,
    "terminal stack stage must be nested in the terminal stack region",
  );
  const stageContent = stage.content;

  const semanticArticlePattern = /<article\b(?=[^>]*class="terminal terminal-card")[^>]*>/g;
  assert.equal((html.match(semanticArticlePattern) ?? []).length, 4);
  assert.equal((regionContent.match(semanticArticlePattern) ?? []).length, 4);
  const articleOpenings = stageContent.match(semanticArticlePattern) ?? [];
  assert.equal(articleOpenings.length, 4, "all terminal cards must be inside the stack stage");

  const cards =
    stageContent.match(
      /<article\b(?=[^>]*class="terminal terminal-card")(?=[^>]*data-card-id="session-0[1-4]")[^>]*>[\s\S]*?<\/article>/g,
    ) ?? [];
  assert.equal(cards.length, 4);

  const cardIds = cards.map((card) => {
    const match = card.match(/data-card-id="(session-0[1-4])"/);
    assert.ok(match, "missing stable card ID");
    return match[1];
  });
  assert.deepEqual(cardIds, ["session-01", "session-02", "session-03", "session-04"]);

  const titleBarButtons =
    stageContent.match(
      /<button\b(?=[^>]*class="terminal-header terminal-card-trigger")(?=[^>]*data-card-select="session-0[1-4]")[^>]*>[\s\S]*?<\/button>/g,
    ) ?? [];
  assert.equal(titleBarButtons.length, 4);
  assert.equal(
    (stageContent.match(/class="terminal-header terminal-card-trigger"/g) ?? []).length,
    4,
  );

  const selectedCardIds = titleBarButtons.map((button) => {
    const match = button.match(/data-card-select="(session-0[1-4])"/);
    assert.ok(match, "missing title-bar card selection ID");
    return match[1];
  });
  assert.deepEqual(selectedCardIds, cardIds);

  assert.deepEqual(
    titleBarButtons.map((button) => button.match(/<span class="terminal-session">([^<]+)<\/span>/)?.[1]),
    ["SESSION 01", "SESSION 02", "SESSION 03", "SESSION 04"],
  );
  assert.deepEqual(
    titleBarButtons.map((button) => button.match(/<span class="terminal-title">([^<]+)<\/span>/)?.[1]),
    [
      "PRECURSOR_LABS — zsh",
      "PLACEHOLDER — zsh",
      "PLACEHOLDER — zsh",
      "PLACEHOLDER — zsh",
    ],
  );

  for (const card of cards.slice(1)) {
    const body = card.match(/<div class="terminal-body"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(body, "missing placeholder terminal body");
    assert.equal(
      body[1].trim(),
      '<p class="command"><span class="prompt" aria-hidden="true">$</span><span>content_pending</span></p>',
    );
  }

  const exploreButtons =
    regionContent.match(
      /<button\b(?=[^>]*data-stack-explore(?:\s|=|>))(?=[^>]*aria-expanded="false")[^>]*>Explore<\/button>/g,
    ) ?? [];
  assert.equal(exploreButtons.length, 1);
  assert.equal((regionContent.match(/data-stack-explore(?:\s|=|>)/g) ?? []).length, 1);

  const navs =
    regionContent.match(/<nav\b(?=[^>]*data-stack-nav(?:\s|=|>))(?=[^>]*\shidden(?:\s|>))(?=[^>]*aria-label="[^"]+")[^>]*>[\s\S]*?<\/nav>/g) ?? [];
  assert.equal(navs.length, 1);
  const navButtons = navs[0].match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
  assert.equal(navButtons.length, 5);
  assert.match(navButtons[0], /data-stack-overview/);
  assert.equal(navButtons[0].replace(/<[^>]+>/g, "").trim(), "Overview");
  assert.deepEqual(
    navButtons.slice(1).map((button) => [
      button.match(/data-card-select="(session-0[1-4])"/)?.[1],
      button.match(/aria-pressed="([^"]+)"/)?.[1],
      button.replace(/<[^>]+>/g, "").trim(),
    ]),
    [
      ["session-01", "false", "01"],
      ["session-02", "false", "02"],
      ["session-03", "false", "03"],
      ["session-04", "false", "04"],
    ],
  );

  const expectedBodyLabels = [
    ["session-01", "Precursor Labs command transcript"],
    ["session-02", "Terminal session 02 content"],
    ["session-03", "Terminal session 03 content"],
    ["session-04", "Terminal session 04 content"],
  ];
  const bodyLabels = [];
  const inlineEventAttributePattern = /\son[a-z][\w:.-]*\s*=/i;
  const dataAttributePattern = /\sdata-[a-z0-9_.:-]+/i;
  const unexpectedBodyDataAttributePattern =
    /\sdata-(?!track-link-(?:name|category)\b)[a-z0-9_.:-]+/i;
  const contentEditableAttributePattern =
    /\scontenteditable(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|>)/i;
  const roleAttributePattern =
    /\srole(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|>)/i;
  const forbiddenBodyControlPattern =
    /<(?:button|input|select|textarea|audio|video|iframe|embed|object|summary)\b/i;
  const interactiveRoles = new Set([
    "button",
    "link",
    "checkbox",
    "menuitem",
    "option",
    "radio",
    "slider",
    "spinbutton",
    "switch",
    "tab",
    "textbox",
  ]);
  const hasInteractiveRole = (source) =>
    [...source.matchAll(/\srole\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].some(
      ([, doubleQuoted, singleQuoted, unquoted]) =>
        (doubleQuoted ?? singleQuoted ?? unquoted)
          .split(/\s+/)
          .some((role) => interactiveRoles.has(role.toLowerCase())),
    );

  for (const [index, card] of cards.entries()) {
    const articleOpening = articleOpenings[index];
    const articleWithoutIdentity = articleOpening.replace(
      /\sdata-card-id="session-0[1-4]"/,
      "",
    );
    assert.doesNotMatch(articleWithoutIdentity, dataAttributePattern);
    assert.doesNotMatch(articleOpening, inlineEventAttributePattern);
    assert.doesNotMatch(articleOpening, roleAttributePattern);
    assert.doesNotMatch(articleOpening, contentEditableAttributePattern);

    const buttonEnd = card.indexOf("</button>");
    const bodyStart = card.indexOf('<div class="terminal-body"');
    assert.ok(buttonEnd >= 0 && buttonEnd < bodyStart, "card body must be separate from its button");
    const bodyContentStart = card.indexOf(">", bodyStart) + 1;
    const bodyOpening = card.slice(bodyStart, bodyContentStart);
    assert.doesNotMatch(bodyOpening, dataAttributePattern);
    assert.doesNotMatch(bodyOpening, inlineEventAttributePattern);
    assert.deepEqual(
      bodyOpening.match(new RegExp(roleAttributePattern.source, "gi")) ?? [],
      [' role="region"'],
    );
    assert.doesNotMatch(bodyOpening, contentEditableAttributePattern);

    const bodyEnd = card.indexOf("</div>", bodyStart);
    assert.ok(bodyEnd >= 0, "missing card body closing tag");
    const bodyContent = card.slice(bodyContentStart, bodyEnd);
    assert.doesNotMatch(bodyContent, unexpectedBodyDataAttributePattern);
    assert.doesNotMatch(bodyContent, inlineEventAttributePattern);
    assert.equal(
      hasInteractiveRole(bodyContent),
      false,
      "card body content cannot have an interactive role",
    );
    assert.doesNotMatch(bodyContent, contentEditableAttributePattern);
    assert.doesNotMatch(bodyContent, forbiddenBodyControlPattern);

    const contentLinks = bodyContent.match(/<a\b[^>]*>/gi) ?? [];
    for (const link of contentLinks) {
      assert.match(link, /\sdata-track-link-name="[^"]+"/);
      assert.match(link, /\sdata-track-link-category="(?:backer|experience)"/);
    }

    assert.equal((card.match(/<div class="terminal-body"/g) ?? []).length, 1);
    const bodyLabel = bodyOpening.match(/\saria-label="([^"]+)"/)?.[1]?.trim();
    assert.ok(bodyLabel, "each card body must have a non-empty accessible label");
    bodyLabels.push([cardIds[index], bodyLabel]);
  }
  assert.deepEqual(bodyLabels, expectedBodyLabels);
  assert.equal(new Set(bodyLabels.map(([, label]) => label)).size, 4);

  assert.equal((html.match(/<h1 class="visually-hidden">Precursor Labs<\/h1>/g) ?? []).length, 1);
  assert.ok(titleBarButtons.every((button) => !/<h[1-6]\b/.test(button)));

  const buttonLabels = [...html.matchAll(/<button\b[^>]*aria-label="([^"]+)"[^>]*>/g)].map(
    ([, label]) => label,
  );
  assert.equal(new Set(buttonLabels).size, buttonLabels.length, "button labels must be unique");
});

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
  const controls = html.match(
    /<span class="window-controls" aria-hidden="true">([\s\S]*?)<\/span>\s*<span class="terminal-title">/,
  );
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
