import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import gsapModule from "gsap";

const gsap = gsapModule.gsap;

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
const stackModelUrl = new URL("../src/terminal-stack-model.ts", import.meta.url);
const stackControllerPath = new URL("../src/terminal-stack.ts", import.meta.url);
const loadStackModel = () => import(stackModelUrl.href);
const cursorIconPath = new URL("../public/cursor-text-green.svg", import.meta.url);
const expectedCursorIcon = `<!--
tags: [editor, indicate, position, input, mouse, type, cursor, text, typography, writing]
category: Text
version: "1.39"
unicode: "ee6d"
color: "#659F58"
-->
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="#659F58"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M10 12h4" />
  <path d="M9 4a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3" />
  <path d="M15 4a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3" />
</svg>
`;

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

const decodeBasicHtml = (value) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

const baselineWritings = [
  ["How to get listed on OpenRouter as an inference provider", "dylan vu", "2026-08-21", "https://dylanvu.substack.com/p/how-to-get-listed-on-openrouter-as"],
  ["How Computer Use Crosses the Chasm: Tab Autocomplete for Your Next Action", "dylan vu", "2026-08-17", "https://dylanvu.substack.com/p/how-computer-use-crosses-the-chasm"],
  ["From recall to judgment", "hands", "2026-08-13", "https://handsdiff.substack.com/p/from-recall-to-judgment"],
  ["Reverse Engineering NetworkIDBD", "Jakub Janiak", "2026-08-12", "https://impermanentfoundation.substack.com/p/reverse-engineering-networkidbd"],
  ["Which shape should you rent?", "Alex Janiak", "2026-08-05", "https://x.com/0xjaniak/status/2084830086981693713"],
  ["The Missing Step Between Recording and Prediction", "dylan vu", "2026-07-28", "https://dylanvu.substack.com/p/the-missing-step-between-recording"],
  ["Quantized endpoints charge less per token but more per answer", "Alex Janiak", "2026-07-28", "https://collectgarbage.substack.com/p/quantized-endpoints-charge-less-per"],
  ["Context costs 10x more than tokens", "hands", "2026-07-22", "https://handsdiff.substack.com/p/context-costs-10x-more-than-tokens"],
  ["Why New GPU Fleets Can Go Unfunded in a Compute Shortage", "dylan vu", "2026-07-21", "https://dylanvu.substack.com/p/why-new-gpu-fleets-can-go-unfunded"],
  ["Compute on the Spot", "Jakub Janiak", "2026-07-20", "https://impermanentfoundation.substack.com/p/compute-on-the-spot"],
  ["The Verification Gap Wasn't the Financing Gap", "dylan vu", "2026-07-20", "https://dylanvu.substack.com/p/the-verification-gap-wasnt-the-financing"],
  ["Cheaper tokens, at what cost?", "Alex Janiak", "2026-07-15", "https://collectgarbage.substack.com/p/cheaper-tokens-at-what-cost"],
  ["The Track Record That Can't Travel", "dylan vu", "2026-07-13", "https://dylanvu.substack.com/p/the-track-record-that-cant-travel"],
  ["Transformer Inference Basics", "Alex Janiak", "2026-07-10", "https://collectgarbage.substack.com/p/transformer-inference-basics"],
  ["What success looks like", "Jakub Janiak", "2026-07-09", "https://impermanentfoundation.substack.com/p/what-success-looks-like"],
  ["GPU Basics: What & Why", "Alex Janiak", "2026-07-06", "https://collectgarbage.substack.com/p/gpu-basics-what-and-why"],
  ["Do local data/models actually make sense?", "hands", "2026-07-06", "https://handsdiff.substack.com/p/do-local-datamodels-actually-make"],
  ["The Ununderwritten Half of GPU Credit", "dylan vu", "2026-07-06", "https://dylanvu.substack.com/p/the-ununderwritten-half-of-gpu-credit"],
  ["Compute Market Questions", "Jakub Janiak", "2026-06-22", "https://impermanentfoundation.substack.com/p/compute-market-questions"],
  ["Actualization through superintelligence", "hands", "2026-06-22", "https://handsdiff.substack.com/p/actualization-through-superintelligence"],
  ["The Race Against China is Partly Instrumental", "Jakub Janiak", "2026-06-18", "https://impermanentfoundation.substack.com/p/the-race-against-china-is-partly"],
  ["Reasoning through agentic memory", "hands", "2026-06-05", "https://handsdiff.substack.com/p/reasoning-through-agentic-memory"],
  ["The Forecast Is Not The Product", "dylan vu", "2026-06-02", "https://dylanvu.substack.com/p/the-forecast-is-not-the-product"],
  ["Deep Reinforcement Learning", "hands", "2026-06-01", "https://handsdiff.substack.com/p/deep-reinforcement-learning"],
  ["AI Timelines as of Early May 2026", "Jakub Janiak", "2026-05-27", "https://impermanentfoundation.substack.com/p/draft-ai-timelines-as-of-early-may"],
  ["Some AGI Answers", "hands", "2026-05-21", "https://handsdiff.substack.com/p/some-agi-answers"],
  ["Open Questions - AGI", "hands", "2026-05-11", "https://handsdiff.substack.com/p/open-questions-agi"],
  ["What traits do LLMs lack? Are they solvable?", "hands", "2026-05-03", "https://handsdiff.substack.com/p/what-traits-do-llms-lack-are-they"],
  ["humanity made the internet hostile to AI agents", "Jakub Janiak", "2026-04-06", "https://impermanentfoundation.substack.com/p/humanity-made-the-internet-hostile"],
  ["The Atomic Unit of Agentic Work is Runtime", "Jakub Janiak", "2026-04-03", "https://impermanentfoundation.substack.com/p/the-atomic-unit-of-agentic-work-is"],
];
const expectedWritings = JSON.parse(read("data/writings.json")).map(
  ({ title, author, publishedAt, url }) => [title, author, publishedAt, url],
);

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
      "PRECURSOR_WRITINGS — zsh",
      "PRECURSOR_PROJECTS — zsh",
      "PRECURSOR_CONTACT — zsh",
    ],
  );

  const bodyElements = cards.map((card) =>
    extractElementByClass(card, "div", ["terminal-body"], "missing terminal body"),
  );
  const contactCommandParagraphs =
    (bodyElements[3].content.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? []).filter((paragraph) =>
      hasClassTokens(getOpeningTag(paragraph, "p"), ["command"]),
    );
  assert.equal(contactCommandParagraphs.length, 1);
  assert.match(contactCommandParagraphs[0], /\$<\/span><span>contact --new<\/span>/);

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

  const exploreButton = extractElement(
    regionContent,
    "button",
    /<button\b(?=[^>]*data-stack-explore(?:\s|=|>))[^>]*>/,
    "missing Explore control",
  );
  assert.equal(getAttributeValue(exploreButton.opening, "class"), "terminal-stack-explore");
  assert.equal(getAttributeValue(exploreButton.opening, "type"), "button");
  assert.match(exploreButton.opening, /\sdata-stack-explore(?:\s|>)/);
  assert.equal(getAttributeValue(exploreButton.opening, "aria-expanded"), "false");
  assert.equal(getAttributeValue(exploreButton.opening, "aria-controls"), "terminal-stack-nav");
  assert.equal(
    getAttributeValue(exploreButton.opening, "aria-label"),
    "Explore terminal sessions",
  );
  assert.equal(
    exploreButton.content.trim(),
    '<img class="terminal-stack-cursor-icon terminal-stack-explore-icon" src="/cursor-text-green.svg" alt="" aria-hidden="true" width="24" height="24" />',
  );
  assert.equal((regionContent.match(/data-stack-explore(?:\s|=|>)/g) ?? []).length, 1);

  const navs =
    regionContent.match(/<nav\b(?=[^>]*data-stack-nav(?:\s|=|>))(?=[^>]*\shidden(?:\s|>))(?=[^>]*aria-label="[^"]+")[^>]*>[\s\S]*?<\/nav>/g) ?? [];
  assert.equal(navs.length, 1);
  const navButtons = navs[0].match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
  assert.equal(navButtons.length, 5);
  assert.match(navButtons[0], /data-stack-overview/);
  assert.equal(
    navButtons[0].replace(/^<button\b[^>]*>|<\/button>$/g, "").trim(),
    '<img class="terminal-stack-cursor-icon terminal-stack-overview-icon" src="/cursor-text-green.svg" alt="" aria-hidden="true" width="18" height="18" />',
  );
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
    ["session-02", "Precursor Labs writings"],
    ["session-03", "Precursor Labs projects"],
    ["session-04", "Precursor Labs contact"],
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

test("renders the complete deduplicated Precursor writings archive", () => {
  const writingsCard = extractElement(
    html,
    "article",
    /<article\b(?=[^>]*data-card-id="session-02")[^>]*>/,
    "missing Precursor writings card",
  );
  const writingsBody = extractElementByClass(
    writingsCard.content,
    "div",
    ["terminal-body"],
    "missing Precursor writings body",
  );
  const writingList = extractElement(
    writingsBody.content,
    "ol",
    /<ol\b(?=[^>]*data-writing-list(?:\s|=|>))(?=[^>]*class="[^"]*terminal-writing-list[^"]*")[^>]*>/,
    "missing Precursor writings list",
  );
  assert.equal((writingList.content.match(/<!-- WRITINGS:START -->/g) ?? []).length, 1);
  assert.equal((writingList.content.match(/<!-- WRITINGS:END -->/g) ?? []).length, 1);
  assert.ok(
    writingList.content.indexOf("<!-- WRITINGS:START -->") <
      writingList.content.indexOf("<!-- WRITINGS:END -->"),
  );
  const rows = writingList.content.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];

  const actualWritings = rows.map((row) => {
    const link = row.match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0];
    const time = row.match(/<time\b[^>]*>[^<]*<\/time>/i)?.[0];
    const author = getSimpleElementByClass(
      row,
      "span",
      "terminal-writing-author",
      "each writing needs an author",
    );
    assert.ok(link, "each writing needs a link");
    assert.ok(time, "each writing needs a published date");
    const linkOpening = getOpeningTag(link, "a");
    const timeOpening = getOpeningTag(time, "time");
    assert.equal(getAttributeValue(linkOpening, "target"), "_blank");
    assert.equal(getAttributeValue(linkOpening, "rel"), "noreferrer");

    return [
      decodeBasicHtml(link.replace(/<[^>]+>/g, "").trim()),
      author.text,
      getAttributeValue(timeOpening, "datetime"),
      getAttributeValue(linkOpening, "href"),
    ];
  });

  assert.deepEqual(actualWritings, expectedWritings);
  assert.equal(new Set(actualWritings.map(([, , , url]) => url)).size, expectedWritings.length);
  for (const baseline of baselineWritings) {
    assert.equal(
      actualWritings.some((writing) => writing.every((value, index) => value === baseline[index])),
      true,
      `missing baseline writing: ${baseline[0]}`,
    );
  }
  assert.match(writingsBody.content, /\$<\/span><span>ls \.\/writings --sort=published<\/span>/);

  const listRule = getCssRule(css, ".terminal-writing-list");
  const rowRule = getCssRule(css, ".terminal-writing-list li");
  const authorRule = getCssRule(css, ".terminal-writing-author");
  const dateRule = getCssRule(css, ".terminal-writing-list time");
  assert.match(listRule, /list-style:\s*none/);
  assert.match(rowRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto/);
  assert.match(rowRule, /border-bottom:\s*1px solid var\(--line\)/);
  assert.match(authorRule, /color:\s*var\(--muted\)/);
  assert.match(dateRule, /font-variant-numeric:\s*tabular-nums/);
  assert.match(dateRule, /text-align:\s*right/);
});

test("renders the Precursor projects as linked terminal entries", () => {
  const projectsCard = extractElement(
    html,
    "article",
    /<article\b(?=[^>]*data-card-id="session-03")[^>]*>/,
    "missing Precursor projects card",
  );
  const projectsBody = extractElementByClass(
    projectsCard.content,
    "div",
    ["terminal-body"],
    "missing Precursor projects body",
  );
  const projectList = extractElement(
    projectsBody.content,
    "ul",
    /<ul\b(?=[^>]*data-project-list(?:\s|=|>))(?=[^>]*class="[^"]*terminal-project-list[^"]*")[^>]*>/,
    "missing Precursor projects list",
  );
  const rows = projectList.content.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];

  const actualProjects = rows.map((row) => {
    const link = row.match(/<a\b[^>]*>[^<]*<\/a>/i)?.[0];
    const description = getSimpleElementByClass(
      row,
      "p",
      "terminal-project-description",
      "each project needs a description",
    );
    assert.ok(link, "each project needs a link");
    const linkOpening = getOpeningTag(link, "a");
    assert.equal(getAttributeValue(linkOpening, "target"), "_blank");
    assert.equal(getAttributeValue(linkOpening, "rel"), "noreferrer");

    return [
      link.replace(/<[^>]+>/g, "").trim(),
      getAttributeValue(linkOpening, "href"),
      description.text,
    ];
  });

  assert.deepEqual(actualProjects, [
    [
      "inferenceproviderstats.com",
      "https://model-demand-analytics.vercel.app/?model=tencent%2Fhy3-20260706",
      "Checks OpenRouter model demand, model facts, and calculated model-level supply.",
    ],
    [
      "coupled",
      "https://github.com/handsdiff/coupled",
      "A local-only macOS experiment for signals that can support read/write inference.",
    ],
    [
      "combinator",
      "https://www.combinator.trade/",
      "Multi-option decision market infrastructure for your launchpad, project, or token",
    ],
  ]);
  assert.match(projectsBody.content, /\$<\/span><span>ls \.\/projects<\/span>/);

  const listRule = getCssRule(css, ".terminal-project-list");
  const rowRule = getCssRule(css, ".terminal-project-list li");
  const descriptionRule = getCssRule(css, ".terminal-project-description");
  assert.match(listRule, /list-style:\s*none/);
  assert.match(rowRule, /border-bottom:\s*1px solid var\(--line\)/);
  assert.match(descriptionRule, /color:\s*var\(--muted\)/);
});

test("ships the exact approved cursor icon source", () => {
  assert.ok(existsSync(cursorIconPath), "missing approved cursor icon");
  const cursorIcon = readFileSync(cursorIconPath, "utf8");

  assert.equal(cursorIcon, expectedCursorIcon);
  assert.match(cursorIcon, /stroke="#659F58"/);
  assert.match(cursorIcon, /<path d="M10 12h4" \/>/);
  assert.match(cursorIcon, /unicode: "ee6d"/);
});

test("renders the approved command transcript and removes old controls", () => {
  const expectedCommands = [
    "about",
    "thesis",
    "research and interests",
    "backers",
    "team experience",
    "links",
  ];
  const expectedParagraphs = [
    "Precursor Labs is a research company studying the organizing principles and infrastructure for collective intelligence.",
    "We believe the next generation of autonomous systems will need to coordinate with humans and agents, reason in dynamic environments, and allocate resources under uncertainty.",
    "We are engineers, financiers, and company builders focusing on multi-agent systems in dynamic social environments, as well as resource scheduling and memory management for latency-constrained inference serving.",
    "We are especially interested in partners working on interactive learning, multi-agent RL, KV cache allocation, and scheduling.",
  ];
  const transcriptEntries =
    html.match(/<section class="transcript-entry">[\s\S]*?<\/section>/g) ?? [];

  assert.equal(transcriptEntries.length, 6);

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
  assert.doesNotMatch(html, /class="final-prompt"|class="cursor"/);
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
    ["Twitter", "https://x.com/precursorlabs", "x", "social"],
    ["Substack", "https://precursorlabs.substack.com/", "substack", "social"],
    [
      "LinkedIn",
      "https://www.linkedin.com/company/precursorlab/",
      "linkedin",
      "social",
    ],
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
  assert.match(allCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(allCss, /step-end/);
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

test("starts the isolated terminal stack controller with page cleanup", () => {
  assert.ok(existsSync(stackControllerPath), "missing terminal stack controller");
  const controller = readFileSync(stackControllerPath, "utf8");

  assert.match(
    main,
    /import\s+\{\s*startTerminalStack\s*\}\s+from\s+"\.\/terminal-stack\.ts"/,
  );
  assert.match(main, /querySelector<HTMLElement>\("\[data-terminal-stack\]"\)/);
  assert.match(main, /startTerminalStack\(terminalStack\)/);
  assert.match(
    main,
    /window\.addEventListener\("pagehide",\s*stopTerminalStack,\s*\{ once:\s*true \}\)/,
  );
  assert.match(controller, /ResizeObserver/);
  assert.match(controller, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(controller, /cleanupStackResources\(resources\)/);
  assert.doesNotMatch(controller, /preventDefault\s*\(/);
  assert.doesNotMatch(controller, /\.terminal-body/);
  assert.doesNotMatch(controller, /trackMixpanelEvent|mixpanel/i);
});

test("resets the native title-bar buttons and keeps the page heading available", () => {
  const terminalRule = getCssRule(css, ".terminal");
  assert.match(terminalRule, /grid-template-rows:\s*minmax\(44px,\s*auto\)\s+minmax\(0,\s*1fr\)/);

  const terminalHeaderRule = getCssRule(css, ".terminal-header");
  assert.match(terminalHeaderRule, /width:\s*100%/);
  assert.match(terminalHeaderRule, /appearance:\s*none/);
  assert.match(terminalHeaderRule, /border:\s*0/);
  assert.match(terminalHeaderRule, /font:\s*inherit/);
  assert.match(terminalHeaderRule, /min-height:\s*44px/);

  const terminalTitleRule = getCssRule(css, ".terminal-title");
  assert.match(terminalTitleRule, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(css, /\.terminal-header h1/);

  const visuallyHiddenRule = getCssRule(css, ".visually-hidden");
  assert.match(visuallyHiddenRule, /position:\s*absolute/);
  assert.match(visuallyHiddenRule, /clip-path:\s*inset\(50%\)/);
});

test("defines a solid compact resting stack with session 01 in front", async () => {
  const { getRestTransforms } = await loadStackModel();
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

  const expectedRestTransforms = getRestTransforms(4);
  const cardIds = ["session-01", "session-02", "session-03", "session-04"];
  for (const [index, cardId] of cardIds.entries()) {
    const restingRule = getCssRule(
      terminalStackCss,
      `.terminal-card[data-card-id="${cardId}"]`,
    );
    const transform = restingRule.match(
      /transform:\s*translate\(-50%,\s*-50%\)\s+translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px,\s*0\)\s+rotate\((-?[\d.]+)deg\)\s+scale\(([\d.]+)\)/,
    );
    assert.ok(transform, `missing exact resting transform for ${cardId}`);
    assert.deepEqual(
      {
        x: Number(transform[1]),
        y: Number(transform[2]),
        rotation: Number(transform[3]),
        scale: Number(transform[4]),
        zIndex: Number(restingRule.match(/z-index:\s*(\d+)/)?.[1]),
      },
      {
        x: expectedRestTransforms[index].x,
        y: expectedRestTransforms[index].y,
        rotation: expectedRestTransforms[index].rotation,
        scale: expectedRestTransforms[index].scale,
        zIndex: expectedRestTransforms[index].zIndex,
      },
    );
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
  assert.match(exploreRule, /display:\s*grid/);
  assert.match(exploreRule, /place-items:\s*center/);
  assert.match(exploreRule, /width:\s*44px/);
  assert.match(exploreRule, /height:\s*44px/);
  assert.match(exploreRule, /min-width:\s*44px/);
  assert.match(exploreRule, /min-height:\s*44px/);
  assert.match(exploreRule, /padding:\s*0/);
  assert.match(exploreRule, /border:\s*1px solid var\(--line\)/);
  assert.match(exploreRule, /border-radius:\s*999px/);
  assert.match(exploreRule, /font:\s*inherit/);

  const navRule = getCssRule(terminalStackCss, ".terminal-stack-nav");
  assert.match(navRule, /width:\s*auto/);
  assert.match(navRule, /height:\s*44px/);
  assert.match(navRule, /grid-template-columns:\s*repeat\(5,\s*44px\)/);
  assert.match(navRule, /border:\s*1px solid var\(--line\)/);
  assert.match(navRule, /border-radius:\s*999px/);
  assert.match(navRule, /overflow:\s*hidden/);

  const navButtonRule = getCssRule(terminalStackCss, ".terminal-stack-nav button");
  assert.match(navButtonRule, /display:\s*grid/);
  assert.match(navButtonRule, /place-items:\s*center/);
  assert.match(navButtonRule, /min-height:\s*44px/);
  assert.match(navButtonRule, /padding:\s*0/);
  assert.match(navButtonRule, /border-radius:\s*0/);

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
    /\.terminal-stack-nav button:focus-visible:not\(\[data-suppress-focus-ring\]\)/,
  );
  assert.match(
    getCssRule(
      terminalStackCss,
      ".terminal-stack-nav button[data-suppress-focus-ring]",
    ),
    /outline:\s*none/,
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

test("blinks the Explore cursor while keeping the border quiet at rest", () => {
  const exploreRule = getCssRule(terminalStackCss, ".terminal-stack-explore");
  assert.match(exploreRule, /border:\s*1px solid var\(--line\)/);
  assert.doesNotMatch(exploreRule, /animation:/);
  const iconRule = getCssRule(terminalStackCss, ".terminal-stack-explore-icon");
  assert.match(iconRule, /animation:\s*cursor-blink 1\.2s step-end infinite/);
  const overviewIconRule = getCssRule(terminalStackCss, ".terminal-stack-overview-icon");
  assert.match(overviewIconRule, /width:\s*18px/);
  assert.match(overviewIconRule, /height:\s*18px/);
  assert.match(overviewIconRule, /transform:\s*translateX\(2px\)/);
  assert.match(
    terminalStackCss,
    /\.terminal-stack-explore\[data-pointer-hovered\] \.terminal-stack-explore-icon\s*\{[^}]*visibility:\s*visible;[^}]*animation:\s*none;/s,
  );
  assert.match(
    terminalStackCss,
    /\.terminal-stack-explore\[data-pointer-hovered\]\s*\{[^}]*border-color:\s*var\(--accent\);/s,
  );
  assert.doesNotMatch(
    terminalStackCss,
    /\.terminal-stack-explore:hover \.terminal-stack-explore-icon/,
  );
  assert.match(
    getCssRule(terminalStackCss, '.terminal-stack-explore[hidden]'),
    /display:\s*none/,
  );
  assert.match(
    css,
    /@keyframes\s+cursor-blink\s*\{\s*0%,\s*49%\s*\{[^}]*visibility:\s*visible[^}]*\}\s*50%,\s*100%\s*\{[^}]*visibility:\s*hidden[^}]*\}\s*\}/s,
  );
  assert.doesNotMatch(terminalStackCss, /@keyframes\s+explore-border-blink/);

  const reducedMotion = terminalStackCss.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}\s*$/,
  );
  assert.ok(reducedMotion, "missing terminal stack reduced-motion rules");
  assert.match(
    reducedMotion[1],
    /\.terminal-stack-explore-icon\s*\{[^}]*animation:\s*none/s,
  );
  assert.doesNotMatch(html, /class="final-prompt"|class="cursor"/);
  assert.doesNotMatch(css, /\.final-prompt/);
  assert.doesNotMatch(css, /(?:^|[},])\s*\.cursor(?=\s*[{,])/m);
  assert.match(css, /\.prompt,\s*\.terminal-note\s*\{[^}]*color:\s*var\(--muted\)/s);
});

test("uses the real desktop CSS geometry for a selected stack nonvertical layout", async () => {
  const { getLayoutMode } = await loadStackModel();
  const pageShellRule = getCssRule(css, ".page-shell");
  const regionRule = getCssRule(terminalStackCss, ".terminal-stack-region");
  const centeredClosedRule = getCssRule(
    terminalStackCss,
    '.terminal-stack-region[data-stack-open="false"]:is([data-layout-mode="spread"], [data-layout-mode="compressed"])',
  );
  const centeredPreviewRule = getCssRule(
    terminalStackCss,
    '.terminal-stack-region[data-stack-open="true"]:not([data-active-card]):is([data-layout-mode="spread"], [data-layout-mode="compressed"])',
  );
  const focusedRule = getCssRule(
    terminalStackCss,
    '.terminal-stack-region[data-active-card]:is([data-layout-mode="spread"], [data-layout-mode="compressed"])',
  );
  const stageRule = getCssRule(terminalStackCss, ".terminal-stack-stage");
  const wideNonverticalPageRule = terminalStackCss.match(
    /@media\s*\(min-width:\s*601px\)\s*and\s*\(min-height:\s*561px\)\s*and\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[\s\S]*?\.page-shell:has\(\[data-terminal-stack\]\[data-layout-mode="spread"\]\),\s*\.page-shell:has\(\[data-terminal-stack\]\[data-layout-mode="compressed"\]\)\s*\{([^}]*)\}/,
  );

  assert.match(pageShellRule, /padding:\s*20px/);
  assert.ok(wideNonverticalPageRule, "missing scoped nonvertical page padding");
  assert.match(wideNonverticalPageRule[1], /padding-top:\s*11px/);
  assert.match(wideNonverticalPageRule[1], /padding-bottom:\s*0/);
  assert.match(regionRule, /--terminal-card-width:\s*min\(560px,\s*calc\(100vw - 40px\)\)/);
  assert.match(
    regionRule,
    /--terminal-card-height:\s*clamp\(440px,\s*calc\(100svh - 155px\),\s*760px\)/,
  );
  assert.match(regionRule, /width:\s*min\(100%,\s*1440px\)/);
  assert.match(regionRule, /--terminal-fan-top-space:\s*72px/);
  assert.match(regionRule, /gap:\s*28px/);
  assert.match(regionRule, /transition:\s*transform 120ms ease/);
  assert.match(centeredClosedRule, /transform:\s*translateY\(-44\.5px\)/);
  assert.match(centeredPreviewRule, /transform:\s*translateY\(-44\.5px\)/);
  assert.match(
    focusedRule,
    /transform:\s*translateY\(var\(--terminal-active-center-offset,\s*0px\)\)/,
  );
  assert.match(focusedRule, /gap:\s*24px/);
  assert.doesNotMatch(focusedRule, /translateY\(-20px\)/);
  assert.match(stageRule, /width:\s*100%/);

  const viewportWidth = 1280;
  const viewportHeight = 900;
  const containerWidth = viewportWidth - 40;
  const cardWidth = 560;
  const cardHeight = Math.min(760, Math.max(440, viewportHeight - 155));

  assert.equal(containerWidth, 1240);
  assert.equal(cardHeight, 745);
  assert.equal(
    getLayoutMode({
      availableWidth: viewportWidth,
      containerWidth,
      viewportHeight,
      cardWidth,
      cardHeight,
      cardCount: 4,
    }),
    "compressed",
  );
});

test("balances the closed card and Explore control inside the viewport", () => {
  const regionRule = getCssRule(terminalStackCss, ".terminal-stack-region");
  const centeredClosedRule = getCssRule(
    terminalStackCss,
    '.terminal-stack-region[data-stack-open="false"]:is([data-layout-mode="spread"], [data-layout-mode="compressed"])',
  );
  const exploreRule = getCssRule(terminalStackCss, ".terminal-stack-explore");
  const viewportHeight = 900;
  const pageTopPadding = 11;
  const pageBottomPadding = 0;
  const fanTopSpace = Number(
    regionRule.match(/--terminal-fan-top-space:\s*([\d.]+)px/)?.[1],
  );
  const controlGap = Number(regionRule.match(/gap:\s*([\d.]+)px/)?.[1]);
  const controlHeight = Number(
    exploreRule.match(/height:\s*([\d.]+)px/)?.[1],
  );
  const closedOffset = Number(
    centeredClosedRule.match(/translateY\((-?[\d.]+)px\)/)?.[1],
  );
  const cardHeight = Math.min(760, Math.max(440, viewportHeight - 155));
  const regionHeight = cardHeight + fanTopSpace + controlGap + controlHeight;
  const regionTop =
    pageTopPadding +
    (viewportHeight - pageTopPadding - pageBottomPadding - regionHeight) / 2;
  const cardTop = regionTop + closedOffset + fanTopSpace + 6;
  const controlBottom = regionTop + closedOffset + regionHeight;
  const bottomSpace = viewportHeight - controlBottom;

  assert.equal(cardTop, bottomSpace);
});

test("fits the nonvertical document and Explore control inside a 1280x900 viewport", async () => {
  const { NONVERTICAL_LAYOUT_GEOMETRY: geometry } = await loadStackModel();
  const regionRule = getCssRule(terminalStackCss, ".terminal-stack-region");
  const stageRule = getCssRule(terminalStackCss, ".terminal-stack-stage");
  const cardRule = getCssRule(terminalStackCss, ".terminal-card");
  const exploreRule = getCssRule(terminalStackCss, ".terminal-stack-explore");
  const fanTopSpace = Number(
    regionRule.match(/--terminal-fan-top-space:\s*(\d+)px/)?.[1],
  );
  const controlGap = Number(regionRule.match(/gap:\s*(\d+)px/)?.[1]);
  const controlHeight = Number(
    exploreRule.match(/min-height:\s*(\d+)px/)?.[1],
  );
  const viewportHeight = 900;
  const cardHeight = Math.min(760, Math.max(440, viewportHeight - 155));
  const stageHeight = cardHeight + fanTopSpace;
  const stackHeight = stageHeight + controlGap + controlHeight;
  const wideNonverticalPageRule = terminalStackCss.match(
    /@media\s*\(min-width:\s*601px\)\s*and\s*\(min-height:\s*561px\)\s*and\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[\s\S]*?\.page-shell:has\(\[data-terminal-stack\]\[data-layout-mode="spread"\]\),\s*\.page-shell:has\(\[data-terminal-stack\]\[data-layout-mode="compressed"\]\)\s*\{([^}]*)\}/,
  );
  const nonverticalTopPadding = Number(
    wideNonverticalPageRule?.[1].match(/padding-top:\s*(\d+)px/)?.[1],
  );
  const nonverticalBottomPadding = Number(
    wideNonverticalPageRule?.[1].match(/padding-bottom:\s*(\d+)(?:px)?/)?.[1],
  );
  const stackBottom = nonverticalTopPadding + stackHeight;
  const documentHeight =
    nonverticalTopPadding + stackHeight + nonverticalBottomPadding;

  assert.equal(nonverticalTopPadding, geometry.pageTopPadding);
  assert.equal(fanTopSpace, geometry.fanTopSpace);
  assert.equal(controlGap, geometry.controlGap);
  assert.equal(controlHeight, geometry.controlHeight);

  assert.match(
    stageRule,
    /height:\s*calc\(var\(--terminal-card-height\) \+ var\(--terminal-fan-top-space\)\)/,
  );
  assert.match(
    cardRule,
    /top:\s*calc\(50% \+ \(var\(--terminal-fan-top-space\) \/ 2\)\)/,
  );
  assert.equal(stackBottom, viewportHeight);
  assert.equal(documentHeight, viewportHeight);
  assert.ok(wideNonverticalPageRule, "missing scoped nonvertical page padding");
});

test("reserves and removes the nonvertical fan top clearance", () => {
  const regionRule = getCssRule(terminalStackCss, ".terminal-stack-region");
  const stageRule = getCssRule(terminalStackCss, ".terminal-stack-stage");
  const cardRule = getCssRule(terminalStackCss, ".terminal-card");

  assert.match(regionRule, /--terminal-fan-top-space:\s*\d+px/);
  assert.match(
    stageRule,
    /height:\s*calc\(var\(--terminal-card-height\) \+ var\(--terminal-fan-top-space\)\)/,
  );
  assert.match(
    cardRule,
    /top:\s*calc\(50% \+ \(var\(--terminal-fan-top-space\) \/ 2\)\)/,
  );

  const verticalRegionRule = getCssRule(
    terminalStackCss,
    '[data-layout-mode="vertical"].terminal-stack-region',
  );
  const verticalStageRule = getCssRule(
    terminalStackCss,
    '[data-layout-mode="vertical"] .terminal-stack-stage',
  );
  const verticalCardRule = getCssRule(
    terminalStackCss,
    '[data-layout-mode="vertical"] .terminal-card',
  );
  assert.match(verticalRegionRule, /--terminal-fan-top-space:\s*0px/);
  assert.match(verticalStageRule, /height:\s*auto/);
  assert.match(verticalCardRule, /top:\s*auto/);

  const fanTopSpace = Number(
    regionRule.match(/--terminal-fan-top-space:\s*(\d+)px/)?.[1],
  );
  const controlGap = Number(regionRule.match(/gap:\s*(\d+)px/)?.[1]);
  const staticPileHeight = 600 + fanTopSpace + controlGap + 44 + 2;
  const noScriptShortScreen = terminalStackCss.match(
    new RegExp(
      `@media\\s*\\(max-height:\\s*${staticPileHeight}px\\)\\s*\\{([\\s\\S]*?)\\n\\}`,
    ),
  );
  assert.ok(noScriptShortScreen, "missing short-screen static-pile fallback");
  assert.match(
    noScriptShortScreen[1],
    /\[data-terminal-stack\]:not\(\[data-initialized\]\)\s*\{[^}]*--terminal-fan-top-space:\s*0px/s,
  );

  const reducedMotion = terminalStackCss.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}\s*$/,
  );
  assert.ok(reducedMotion, "missing terminal stack reduced-motion rules");
  assert.match(
    reducedMotion[1],
    /\.terminal-stack-region\s*\{[^}]*--terminal-fan-top-space:\s*0px[^}]*height:\s*auto/s,
  );
  assert.match(reducedMotion[1], /\.terminal-card\s*\{[^}]*top:\s*auto/s);
});

test("fan top clearance contains selected elastic y and scale overshoot", () => {
  const regionRule = getCssRule(terminalStackCss, ".terminal-stack-region");
  const fanTopSpace = Number(
    regionRule.match(/--terminal-fan-top-space:\s*(\d+)px/)?.[1],
  );
  const ease = gsap.parseEase("elastic.out(0.7, 0.5)");
  let peakProgress = Number.NEGATIVE_INFINITY;
  for (let index = 0; index <= 200000; index += 1) {
    peakProgress = Math.max(peakProgress, ease(index / 200000));
  }

  const viewportHeight = 900;
  const pageTopPadding = 11;
  const pageBottomPadding = 0;
  const cardWidth = 560;
  const cardHeight = 745;
  const controlsFootprint = 28 + 44;
  const regionTop =
    pageTopPadding +
    (viewportHeight -
      pageTopPadding -
      pageBottomPadding -
      (cardHeight + fanTopSpace + controlsFootprint)) /
      2;
  const cardTop = regionTop + fanTopSpace;
  const peakY = -15 + (-27 - -15) * peakProgress;
  const peakScale = 1 + (1.05 - 1) * peakProgress;
  const radians = 0;
  const peakUpwardExtent =
    peakScale *
    (cardHeight * Math.cos(radians) +
      (cardWidth / 2) * Math.sin(radians));
  const selectedTop =
    cardTop + cardHeight + peakY - peakUpwardExtent;

  assert.ok(selectedTop >= 12, `selected top ${selectedTop}px clips the page gutter`);
});

test("defines the vertical one-body terminal list contract", () => {
  const scrollingBodyRule = getCssRule(
    terminalStackCss,
    'body:has([data-terminal-stack][data-layout-mode="vertical"])',
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
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /background:\s*#F3F3F1/i);
  assert.match(css, /gap:\s*8px/);
  assert.match(css, /width:\s*10px/);
  assert.match(css, /height:\s*10px/);
  assert.match(css, /#DF6A60/i);
  assert.match(css, /#D9A441/i);
  assert.match(css, /@media\s*\(max-width:\s*420px\)/);
  assert.match(css, /\.terminal-session\s*\{[^}]*display:\s*none/s);
});

test("renders backers, experience, and links as inline separated rows that wrap", () => {
  assert.equal((html.match(/class="output terminal-list terminal-list-inline"/g) ?? []).length, 3);
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
  assert.match(analytics, /"backer"\s*\|\s*"experience"\s*\|\s*"social"/);
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
