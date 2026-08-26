import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("src/styles.css");
const terminalStackCssPath = new URL("../src/terminal-stack.css", import.meta.url);
const terminalStackCss = existsSync(terminalStackCssPath)
  ? readFileSync(terminalStackCssPath, "utf8")
  : "";
const allCss = `${css}\n${terminalStackCss}`;
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

const getOpeningTag = (element, tagName) =>
  element.match(new RegExp(`^<${tagName}\\b[^>]*>`, "i"))?.[0];

const getAttributeValue = (openingTag, attributeName) => {
  const match = openingTag.match(
    new RegExp(
      `\\s${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
};

const hasClassTokens = (openingTag, requiredClasses) => {
  const classes = new Set((getAttributeValue(openingTag, "class") ?? "").split(/\s+/));
  return requiredClasses.every((className) => classes.has(className));
};

const extractElementByClass = (source, tagName, requiredClasses, missingMessage) => {
  const openingTags = source.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
  const opening = openingTags.find((tag) => hasClassTokens(tag, requiredClasses));
  assert.ok(opening, missingMessage);
  return extractElement(
    source.slice(source.indexOf(opening)),
    tagName,
    new RegExp(`^<${tagName}\\b[^>]*>`, "i"),
    missingMessage,
  );
};

const getSimpleElementByClass = (source, tagName, requiredClass, missingMessage) => {
  const elements =
    source.match(new RegExp(`<${tagName}\\b[^>]*>[^<]*<\\/${tagName}>`, "gi")) ?? [];
  const element = elements.find((candidate) =>
    hasClassTokens(getOpeningTag(candidate, tagName), [requiredClass]),
  );
  assert.ok(element, missingMessage);
  return {
    opening: getOpeningTag(element, tagName),
    text: element.replace(/<[^>]+>/g, "").trim(),
  };
};

const getCssRule = (source, selector, missingMessage) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"));
  assert.ok(rule, missingMessage ?? `missing CSS rule for ${selector}`);
  return rule[1];
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

  const findArticleOpenings = (source) =>
    (source.match(/<article\b[^>]*>/gi) ?? []).filter((opening) =>
      hasClassTokens(opening, ["terminal", "terminal-card"]),
    );
  assert.equal(findArticleOpenings(html).length, 4);
  assert.equal(findArticleOpenings(regionContent).length, 4);
  const articleOpenings = findArticleOpenings(stageContent);
  assert.equal(articleOpenings.length, 4, "all terminal cards must be inside the stack stage");

  const cards = (stageContent.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi) ?? []).filter(
    (card) => hasClassTokens(getOpeningTag(card, "article"), ["terminal", "terminal-card"]),
  );
  assert.equal(cards.length, 4);

  const cardIds = cards.map((card) => {
    const cardId = getAttributeValue(getOpeningTag(card, "article"), "data-card-id");
    assert.ok(cardId, "missing stable card ID");
    return cardId;
  });
  assert.deepEqual(cardIds, ["session-01", "session-02", "session-03", "session-04"]);

  const titleBarButtons = cards.map((card) => {
    const matches = (card.match(/<button\b[^>]*>[\s\S]*?<\/button>/gi) ?? []).filter(
      (button) =>
        hasClassTokens(getOpeningTag(button, "button"), [
          "terminal-header",
          "terminal-card-trigger",
        ]),
    );
    assert.equal(matches.length, 1, "each card must have one title-bar button");
    return matches[0];
  });
  assert.equal(titleBarButtons.length, 4);
  assert.equal(
    (stageContent.match(/<button\b[^>]*>/gi) ?? []).filter((opening) =>
      hasClassTokens(opening, ["terminal-header", "terminal-card-trigger"]),
    ).length,
    4,
  );

  const selectedCardIds = titleBarButtons.map((button) =>
    getAttributeValue(getOpeningTag(button, "button"), "data-card-select"),
  );
  assert.deepEqual(selectedCardIds, cardIds);

  const titleElements = titleBarButtons.map((button) =>
    getSimpleElementByClass(button, "span", "terminal-title", "missing terminal title"),
  );
  const sessionElements = titleBarButtons.map((button) =>
    getSimpleElementByClass(button, "span", "terminal-session", "missing session label"),
  );
  assert.deepEqual(sessionElements.map(({ text }) => text), [
    "SESSION 01",
    "SESSION 02",
    "SESSION 03",
    "SESSION 04",
  ]);
  assert.deepEqual(
    titleElements.map(({ text }) => text),
    [
      "PRECURSOR_LABS — zsh",
      "PLACEHOLDER — zsh",
      "PLACEHOLDER — zsh",
      "PLACEHOLDER — zsh",
    ],
  );

  const bodyElements = cards.map((card) =>
    extractElementByClass(card, "div", ["terminal-body"], "missing terminal body"),
  );
  for (const body of bodyElements.slice(1)) {
    const commandParagraphs =
      (body.content.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? []).filter((paragraph) =>
        hasClassTokens(getOpeningTag(paragraph, "p"), ["command"]),
      );
    assert.equal(commandParagraphs.length, 1);
    assert.equal(body.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), "$ content_pending");
  }

  const articleRelationships = cards.map((card, index) => [
    cardIds[index],
    getAttributeValue(getOpeningTag(card, "article"), "aria-labelledby"),
    getAttributeValue(titleElements[index].opening, "id"),
    getAttributeValue(sessionElements[index].opening, "id"),
  ]);
  assert.deepEqual(articleRelationships, [
    ["session-01", "session-01-title session-01-session", "session-01-title", "session-01-session"],
    ["session-02", "session-02-title session-02-session", "session-02-title", "session-02-session"],
    ["session-03", "session-03-title session-03-session", "session-03-title", "session-03-session"],
    ["session-04", "session-04-title session-04-session", "session-04-title", "session-04-session"],
  ]);
  const articleLabelIds = articleRelationships.flatMap(([, relationship]) =>
    relationship?.split(/\s+/) ?? [],
  );
  assert.equal(new Set(articleLabelIds).size, 8);
  for (const labelId of articleLabelIds) {
    assert.equal((html.match(new RegExp(`\\sid="${labelId}"`, "g")) ?? []).length, 1);
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
  const stackActionAttributePattern =
    /\s(?:data-card-select|data-stack-[a-z0-9_.:-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|>)/i;

  for (const [index, card] of cards.entries()) {
    const articleOpening = articleOpenings[index];
    assert.doesNotMatch(articleOpening, stackActionAttributePattern);

    const buttonEnd = card.indexOf("</button>");
    const body = bodyElements[index];
    const bodyStart = card.indexOf(body.opening);
    assert.ok(buttonEnd >= 0 && buttonEnd < bodyStart, "card body must be separate from its button");
    assert.doesNotMatch(body.opening, stackActionAttributePattern);
    const bodyContentOpeningTags = body.content.match(/<[a-z][^>]*>/gi) ?? [];
    for (const openingTag of bodyContentOpeningTags) {
      assert.doesNotMatch(openingTag, stackActionAttributePattern);
    }

    const terminalBodyOpenings = (card.match(/<div\b[^>]*>/gi) ?? []).filter((opening) =>
      hasClassTokens(opening, ["terminal-body"]),
    );
    assert.equal(terminalBodyOpenings.length, 1);
    const bodyLabel = getAttributeValue(body.opening, "aria-label")?.trim();
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
  assert.doesNotMatch(allCss, /box-shadow|linear-gradient|radial-gradient/);
  const responsiveTerminalRule = terminalStackCss.match(
    /@media\s*\(max-width:\s*600px\),\s*\(max-height:\s*560px\)\s*\{[\s\S]*?\.terminal-card\s*\{([^}]*)\}/,
  );
  assert.ok(responsiveTerminalRule, "missing responsive terminal rule");
  assert.match(responsiveTerminalRule[1], /width:\s*calc\(100vw - 24px\)/);
  assert.match(responsiveTerminalRule[1], /height:\s*calc\(100svh - 12px\)/);
});

test("loads the terminal stack layer after the shared visual system", () => {
  assert.ok(existsSync(terminalStackCssPath), "missing terminal stack stylesheet");
  assert.match(
    main,
    /^import "\.\/styles\.css";\nimport "\.\/terminal-stack\.css";/,
  );
});

test("resets the native title-bar buttons and keeps the page heading available", () => {
  const terminalHeaderRule = getCssRule(css, ".terminal-header");
  assert.match(terminalHeaderRule, /width:\s*100%/);
  assert.match(terminalHeaderRule, /appearance:\s*none/);
  assert.match(terminalHeaderRule, /border:\s*0/);
  assert.match(terminalHeaderRule, /font:\s*inherit/);

  const terminalTitleRule = getCssRule(css, ".terminal-title");
  assert.match(terminalTitleRule, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(css, /\.terminal-header h1/);

  const visuallyHiddenRule = getCssRule(css, ".visually-hidden");
  assert.match(visuallyHiddenRule, /position:\s*absolute/);
  assert.match(visuallyHiddenRule, /clip-path:\s*inset\(50%\)/);
});

test("defines a solid compact resting stack with session 01 in front", () => {
  const terminalRule = getCssRule(css, ".terminal");
  assert.match(terminalRule, /border:\s*1px solid var\(--line\)/);
  assert.match(terminalRule, /border-radius:\s*8px/);
  assert.match(terminalRule, /background:\s*var\(--paper\)/);

  const terminalBodyRule = getCssRule(css, ".terminal-body");
  assert.match(terminalBodyRule, /background:\s*var\(--paper\)/);

  const stageRule = getCssRule(terminalStackCss, ".terminal-stack-stage");
  assert.match(stageRule, /transform-origin:\s*center bottom/);
  assert.match(stageRule, /will-change:\s*transform/);
  assert.match(stageRule, /max-width:\s*100%/);

  const cardRule = getCssRule(terminalStackCss, ".terminal-card");
  assert.match(cardRule, /position:\s*absolute/);
  assert.match(cardRule, /transform-origin:\s*center bottom/);
  assert.match(cardRule, /will-change:\s*transform/);

  const expectedLayers = [
    ["session-01", 4],
    ["session-02", 3],
    ["session-03", 2],
    ["session-04", 1],
  ];
  for (const [cardId, zIndex] of expectedLayers) {
    const restingRule = getCssRule(
      terminalStackCss,
      `.terminal-card[data-card-id="${cardId}"]`,
    );
    assert.match(restingRule, /transform:\s*(?!none)[^;]+;/);
    assert.match(restingRule, new RegExp(`z-index:\\s*${zIndex}(?:;|\\s*$)`));
  }

  const readableBodyRule = getCssRule(terminalStackCss, ".terminal-card .terminal-body");
  assert.match(readableBodyRule, /display:\s*block/);

  assert.doesNotMatch(
    `${allCss}\n${main}`,
    /box-shadow|linear-gradient|radial-gradient|ScrollTrigger|Lenis/i,
  );
});

test("keeps stack controls keyboard-sized and fast", () => {
  const exploreRule = getCssRule(terminalStackCss, ".terminal-stack-explore");
  assert.match(exploreRule, /min-height:\s*44px/);
  assert.match(exploreRule, /border:\s*1px solid var\(--line\)/);
  assert.match(exploreRule, /font:\s*inherit/);

  const navButtonRule = getCssRule(terminalStackCss, ".terminal-stack-nav button");
  assert.match(navButtonRule, /min-height:\s*44px/);

  assert.match(
    terminalStackCss,
    /\.terminal-stack-(?:explore|nav button):hover[\s\S]*?background:\s*var\(--hover\)/,
  );
  assert.match(
    terminalStackCss,
    /:focus-visible[\s\S]*?outline:\s*1px solid var\(--accent\)/,
  );
  assert.match(
    terminalStackCss,
    /\[aria-pressed="true"\][\s\S]*?(?:color|border-color):\s*var\(--accent\)/,
  );

  const transitionDurations = [...allCss.matchAll(/transition:\s*([^;]+);/g)].flatMap(
    ([, declaration]) => [...declaration.matchAll(/([\d.]+)ms/g)].map(([, value]) => Number(value)),
  );
  assert.ok(transitionDurations.length > 0, "missing hover transitions");
  assert.ok(
    transitionDurations.every((duration) => duration <= 150),
    "hover transitions must not exceed 150ms",
  );
});

test("defines the vertical one-body terminal list contract", () => {
  const scrollingBodyRule = getCssRule(
    terminalStackCss,
    'body:has([data-layout-mode="vertical"])',
  );
  assert.match(scrollingBodyRule, /overflow-x:\s*hidden/);
  assert.match(scrollingBodyRule, /overflow-y:\s*auto/);

  const verticalStageRule = getCssRule(
    terminalStackCss,
    '[data-layout-mode="vertical"] .terminal-stack-stage',
  );
  assert.match(verticalStageRule, /height:\s*auto/);
  assert.match(verticalStageRule, /overflow:\s*visible/);

  const verticalCardRule = getCssRule(
    terminalStackCss,
    '[data-layout-mode="vertical"] .terminal-card',
  );
  assert.match(verticalCardRule, /position:\s*relative/);
  assert.match(verticalCardRule, /height:\s*44px/);
  assert.match(verticalCardRule, /transform:\s*none/);

  const verticalTriggerRule = getCssRule(
    terminalStackCss,
    '[data-layout-mode="vertical"] .terminal-card-trigger',
  );
  assert.match(verticalTriggerRule, /min-height:\s*44px/);

  const hiddenBodyRule = getCssRule(
    terminalStackCss,
    '[data-layout-mode="vertical"] .terminal-body',
  );
  assert.match(hiddenBodyRule, /display:\s*none/);

  const readableCardIds = ["session-01", "session-02", "session-03", "session-04"];
  const baseBodySelector = ".terminal-card .terminal-body";
  const hiddenBodySelector = '[data-layout-mode="vertical"] .terminal-body';
  const baseBodyOffset = terminalStackCss.indexOf(baseBodySelector);
  const hiddenBodyOffset = terminalStackCss.indexOf(hiddenBodySelector);
  assert.ok(baseBodyOffset >= 0, "missing the default readable terminal body rule");
  assert.ok(hiddenBodyOffset > baseBodyOffset, "vertical hiding must override the default body rule");
  assert.doesNotMatch(
    terminalStackCss,
    /\.terminal-card\[data-card-id="session-01"\]\s+\.terminal-body\s*\{/,
    "a card-specific default display rule can leak session 01 into another active session",
  );

  const defaultBodySelector =
    '[data-layout-mode="vertical"]:not([data-active-card]) [data-card-id="session-01"] .terminal-body';
  const defaultBodyRule = getCssRule(
    terminalStackCss,
    defaultBodySelector,
  );
  assert.match(defaultBodyRule, /display:\s*block/);
  assert.ok(
    terminalStackCss.indexOf(defaultBodySelector) > hiddenBodyOffset,
    "the no-active-card session 01 rule must follow the vertical hiding rule",
  );

  for (const cardId of readableCardIds) {
    const activeBodySelector =
      `[data-layout-mode="vertical"][data-active-card="${cardId}"] ` +
      `[data-card-id="${cardId}"] .terminal-body`;
    const activeBodyRule = getCssRule(
      terminalStackCss,
      activeBodySelector,
    );
    assert.match(activeBodyRule, /display:\s*block/);
    assert.ok(
      terminalStackCss.indexOf(activeBodySelector) > hiddenBodyOffset,
      `${cardId} body display must follow the vertical hiding rule`,
    );
  }

  assert.match(
    terminalStackCss,
    /\[data-layout-mode="vertical"\][\s\S]*?height:\s*clamp\(600px,\s*78svh,\s*760px\)/,
  );
});

test("uses a static readable list when reduced motion is requested", () => {
  const reducedMotion = terminalStackCss.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}\s*$/,
  );
  assert.ok(reducedMotion, "missing terminal stack reduced-motion rules");
  assert.match(reducedMotion[1], /body\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/s);
  assert.match(
    reducedMotion[1],
    /\.terminal-stack-stage\s*\{[^}]*height:\s*auto[^}]*gap:\s*\d+px[^}]*will-change:\s*auto/s,
  );
  assert.match(
    reducedMotion[1],
    /\.terminal-card\s*\{[^}]*position:\s*relative[^}]*transform:\s*none[^}]*will-change:\s*auto[^}]*transition:\s*none/s,
  );
  assert.match(
    reducedMotion[1],
    /\.terminal-card \.terminal-body\s*\{[^}]*display:\s*block/s,
  );
});

test("uses a compact macOS terminal frame", () => {
  const controls = extractElementByClass(
    html,
    "span",
    ["window-controls"],
    "missing decorative macOS window controls",
  );
  assert.match(controls.content, /class="window-control window-control-close"/);
  assert.match(controls.content, /class="window-control window-control-minimize"/);
  assert.match(controls.content, /class="window-control window-control-zoom"/);
  assert.doesNotMatch(controls.content, /<(?:a|button|input|select|textarea)\b|tabindex=/);
  assert.match(html, /PRECURSOR_LABS\s+—\s+zsh/);

  assert.match(allCss, /width:\s*min\(560px,\s*calc\(100vw - 40px\)\)/);
  assert.match(allCss, /height:\s*clamp\(600px,\s*78svh,\s*760px\)/);
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
  assert.match(css, /\.terminal\s*\{[^}]*background:\s*var\(--paper\)/s);
  assert.match(terminalStackCss, /\.terminal-stack-region\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1/s);
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
