#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { syncBlogCatalog } from "./sync-blog-catalog.mjs";

const ROOT = process.cwd();
const BLOGPOSTS_DIR = join(ROOT, "data/blogposts");
const BLOG_INDEX_PATH = join(ROOT, "data/blogposts.json");
const ENV_PATH = join(ROOT, ".env");
const BUFFER_API_URL = "https://api.buffer.com";
const DEFAULT_POST_LIMIT = 100;
const MAX_POSTS_TO_SCAN = 500;
const ANNOUNCEMENT_RE = /\b(?:Check\s+)?JSter\s+#(\d+)/i;
const URL_RE = /(https?:\/\/\S+)\s*$/;
const SHORT_URL_HOST_RE = /(^|\.)buff\.ly$|(^|\.)bit\.ly$|(^|\.)ilo\.im$/i;
const DEFAULT_CATEGORY = "Uncategorized";
const CATEGORY_ORDER = [
  "Libraries",
  "Frameworks",
  "Articles",
  "Techniques",
  "Tools",
  "Runtimes",
];
const CATEGORY_RULES = [
  {
    category: "Runtimes",
    weight: 8,
    patterns: [
      /\b(?:node(?:\.js)?|deno|bun|ecmascript|tc39|v8|javascript\s+engine|js\s+engine|runtime|wasm|webassembly)\b/i,
      /\btypescript\s+\d/i,
    ],
  },
  {
    category: "Frameworks",
    weight: 7,
    patterns: [
      /\b(?:framework|react|vue|angular|svelte|astro|next(?:\.js)?|nuxt|solid|qwik|remix|ember|preact|hono|fastify|express|nestjs|vitepress|docusaurus)\b/i,
    ],
  },
  {
    category: "Tools",
    weight: 6,
    patterns: [
      /\b(?:tool|cli|lsp|formatter|validator|compiler|bundler|build|test(?:ing|s)?|debugger|lint(?:er)?|package\s+manager|npm|pnpm|yarn|vite|webpack|rollup|parcel|esbuild|rspack|rsbuild|biome|eslint|prettier|playwright|vitest|jest|storybook|codemod|diff|editor|devtools|database|sql)\b/i,
    ],
  },
  {
    category: "Techniques",
    weight: 5,
    patterns: [
      /\b(?:api|web\s+api|browser\s+api|css|html|dom|pointerevent|event|cach(?:e|ing)|performance|accessibility|a11y|security|streams?|workers?|service\s+worker|web\s+components|canvas|webgl|animation|state\s+management|routing|patterns?|architecture)\b/i,
    ],
  },
  {
    category: "Libraries",
    weight: 4,
    patterns: [
      /\b(?:library|lib|component|hook|sdk|client|module|plugin|polyfill|widget|parser|renderer|chart|visuali[sz]ation|date|validation|schema|forms?|table|grid|audio|video|image|map|crypto|storage|search\s+params)\b/i,
    ],
  },
  {
    category: "Articles",
    weight: 3,
    patterns: [
      /\b(?:article|blog|guide|tutorial|explainer|case\s+study|how\s+to|building|writing|why|what|lessons?|notes?|thoughts?|turn|best|custom|practical|approach)\b/i,
    ],
  },
];
const ARTICLE_HOST_RE = /(?:^|\.)((?:blog|docs|developer|dev|engineering|learn)\.|medium\.com$|dev\.to$|hashnode\.dev$|substack\.com$)/i;
const GITHUB_HOST_RE = /(^|\.)github\.com$/i;

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = readEnv(ENV_PATH);
  const token = args.token || env.BUFFER_SECRET || env.BUFFER_API_KEY;

  if (!token) {
    throw new Error("Missing BUFFER_SECRET or BUFFER_API_KEY in .env");
  }

  const blogIndex = readJson(BLOG_INDEX_PATH);
  const latest = getLatestJster(blogIndex);
  const nextNumber = args.number || latest.number + 1;
  const previousNumberHint = args.previous || latest.number;
  const nextPostPath = join(
    BLOGPOSTS_DIR,
    `${String(latest.fileNumber + 1)}-jster-${nextNumber}.md`,
  );
  const existingPost = readExistingPost(nextPostPath);

  const { organizationId, channelId } = await resolveBufferTarget(args, token);
  const scannedPosts = await fetchSentPosts(
    token,
    organizationId,
    channelId,
    MAX_POSTS_TO_SCAN,
  );
  const announcement = resolveAnnouncement(
    scannedPosts,
    previousNumberHint,
    args.previous,
  );

  if (!announcement) {
    throw new Error(
      `Could not find a sent Buffer post announcing JSter #${previousNumberHint}.`,
    );
  }

  const fetchedEntries = scannedPosts
    .filter((post) =>
      isAfter(post.sentAt || post.dueAt || post.createdAt, announcement.date),
    )
    .filter((post) => !ANNOUNCEMENT_RE.test(post.text))
    .map(postToEntry)
    .filter(Boolean);
  const expandedEntries = args.skipExpand
    ? fetchedEntries
    : await expandEntryUrls(fetchedEntries);
  const existingEntries = existingPost ? parseMarkdownEntries(existingPost.body) : [];
  const categorizedEntries = categorizeEntries(transformGitHubTitles(expandedEntries));
  const entries = mergeEntries(existingEntries, categorizedEntries);
  const sortedEntries = sortEntries(entries, existingEntries);
  const title = `JSter #${nextNumber}: Libraries and more`;
  const markdown = renderPost({
    number: nextNumber,
    title,
    preamble: existingPost?.preamble || "",
    entries: sortedEntries,
  });
  const nextIndex = [
    ...blogIndex.filter(({ id }) => id !== `jster-${nextNumber}`),
    {
      id: `jster-${nextNumber}`,
      title,
      url: `/blog/jster-${nextNumber}`,
      date: args.date || formatDate(new Date()),
    },
  ];

  if (args.dryRun) {
    console.log(markdown);
    console.error("");
    console.error(`Previous JSter: #${announcement.number}`);
    console.error(`Fetched posts: ${fetchedEntries.length}`);
    console.error(`Expanded links: ${countExpanded(fetchedEntries, expandedEntries)}`);
    console.error(`Would write ${relative(nextPostPath)}`);
    console.error(`Would update ${relative(BLOG_INDEX_PATH)}`);
    return;
  }

  await writeFile(nextPostPath, markdown);
  await writeFile(BLOG_INDEX_PATH, JSON.stringify(nextIndex, null, 2) + "\n");
  const catalogAdditions = await syncBlogCatalog({
    latestOnly: true,
    rewriteCatalogLinks: true,
  });

  console.log(`Previous JSter: #${announcement.number}`);
  console.log(`Fetched posts: ${fetchedEntries.length}`);
  console.log(`Expanded links: ${countExpanded(fetchedEntries, expandedEntries)}`);
  console.log(`Wrote ${relative(nextPostPath)}`);
  console.log(`Updated ${relative(BLOG_INDEX_PATH)}`);
  console.log(`Catalog additions: ${catalogAdditions.length}`);
}

function parseArgs(argv) {
  const ret = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      ret.dryRun = true;
    } else if (arg === "--skip-expand") {
      ret.skipExpand = true;
    } else if (arg === "--token") {
      ret.token = argv[++i];
    } else if (arg === "--organization") {
      ret.organization = argv[++i];
    } else if (arg === "--channel") {
      ret.channel = argv[++i];
    } else if (arg === "--number") {
      ret.number = parsePositiveInteger(argv[++i], "--number");
    } else if (arg === "--previous") {
      ret.previous = parsePositiveInteger(argv[++i], "--previous");
    } else if (arg === "--date") {
      ret.date = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return ret;
}

function printHelp() {
  console.log(
    [
      "Usage: node ./scripts/fetch-new-jster.mjs [options]",
      "",
      "Fetch sent Buffer posts after the latest JSter announcement and render the next post.",
      "",
      "Options:",
      "  --dry-run              Print Markdown without writing files",
      "  --skip-expand          Keep links as they came from Buffer",
      "  --number <number>      Force the issue number to write",
      "  --previous <number>    Force the previous announced JSter number",
      "  --date <date>          Force the blog index date",
      "  --organization <id>    Force Buffer organization id",
      "  --channel <id>         Force Buffer channel id",
    ].join("\n"),
  );
}

function parsePositiveInteger(value, name) {
  const number = Number.parseInt(value, 10);

  if (!number || number < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return number;
}

function readEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);

      if (match) {
        env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }

      return env;
    }, {});
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

async function resolveBufferTarget(args, token) {
  const account = await graphql(token, [
    "query Account {",
    "  account {",
    "    organizations { id name }",
    "  }",
    "}",
  ].join("\n"));
  const organizations = account.data.account.organizations || [];
  const organizationId = args.organization || organizations[0]?.id;

  if (!organizationId) {
    throw new Error("No Buffer organization found. Pass --organization <id>.");
  }

  const channelsResult = await graphql(token, [
    "query Channels($organizationId: OrganizationId!) {",
    "  channels(input: { organizationId: $organizationId }) {",
    "    id",
    "    name",
    "    displayName",
    "    service",
    "  }",
    "}",
  ].join("\n"), { organizationId });
  const channels = channelsResult.data.channels || [];
  const channelId = args.channel || pickChannel(channels);

  if (!channelId) {
    throw new Error("No Buffer channel found. Pass --channel <id>.");
  }

  return { organizationId, channelId };
}

function graphql(token, query, variables = {}) {
  return postJson(BUFFER_API_URL, token, { query, variables }).then((result) => {
    if (result.errors?.length) {
      throw new Error(result.errors.map((error) => error.message).join("\n"));
    }

    return result;
  });
}

async function postJson(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Buffer returned ${response.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error(`Buffer returned invalid JSON: ${text}`);
  }
}

async function fetchSentPosts(token, organizationId, channelId, maxPosts) {
  let after = null;
  let posts = [];

  while (posts.length < maxPosts) {
    const result = await graphql(token, [
      "query Posts($organizationId: OrganizationId!, $channelIds: [ChannelId!], $after: String) {",
      "  posts(",
      `    first: ${DEFAULT_POST_LIMIT}`,
      "    after: $after",
      "    input: {",
      "      organizationId: $organizationId",
      "      filter: { status: [sent], channelIds: $channelIds }",
      "      sort: [{ field: createdAt, direction: desc }]",
      "    }",
      "  ) {",
      "    edges {",
      "      cursor",
      "      node {",
      "        id",
      "        text",
      "        createdAt",
      "        dueAt",
      "        sentAt",
      "      }",
      "    }",
      "    pageInfo { endCursor hasNextPage }",
      "  }",
      "}",
    ].join("\n"), {
      organizationId,
      channelIds: [channelId],
      after,
    });
    const connection = result.data.posts;
    const pagePosts = connection.edges.map((edge) => edge.node);

    posts = posts.concat(pagePosts);

    if (!connection.pageInfo.hasNextPage || !pagePosts.length) {
      break;
    }

    after = connection.pageInfo.endCursor;
  }

  return posts.slice(0, maxPosts);
}

function pickChannel(channels) {
  const jster = channels.find(
    (channel) => channel.name === "jsterlibs" || channel.displayName === "jsterlibs",
  );

  return (jster || channels[0] || {}).id;
}

function getLatestJster(blogIndex) {
  const latestIndex = blogIndex.reduce(
    (latest, entry) => {
      const match = entry.id.match(/^jster-(\d+)$/);

      if (!match) {
        return latest;
      }

      const number = Number.parseInt(match[1], 10);

      return number > latest.number ? { number, entry } : latest;
    },
    { number: 0, entry: undefined },
  );
  const fileNumber = readdirSync(BLOGPOSTS_DIR).reduce((latest, file) => {
    const match = file.match(/^(\d+)-jster-\d+\.(?:md|yml)$/);

    return match ? Math.max(latest, Number.parseInt(match[1], 10)) : latest;
  }, 0);

  return { ...latestIndex, fileNumber };
}

function resolveAnnouncement(posts, localMax, forcedPrevious) {
  const announcements = posts
    .map((post) => {
      const match = post.text.match(ANNOUNCEMENT_RE);

      if (!match) {
        return null;
      }

      return {
        number: Number.parseInt(match[1], 10),
        date: post.sentAt || post.dueAt || post.createdAt,
        post,
      };
    })
    .filter(Boolean);

  if (forcedPrevious) {
    return announcements.find((announcement) => announcement.number === forcedPrevious);
  }

  return (
    announcements.find((announcement) => announcement.number === localMax) ||
    announcements.find((announcement) => announcement.number === localMax - 1) ||
    announcements[0]
  );
}

function isAfter(value, baseline) {
  return new Date(value).getTime() > new Date(baseline).getTime();
}

function postToEntry(post) {
  const match = post.text.match(URL_RE);

  if (!match) {
    return null;
  }

  return {
    title: post.text.slice(0, match.index).replace(/\s+/g, " ").trim(),
    url: match[1].replace(/[.,;:!?)]$/, ""),
    description: "",
    category: "",
  };
}

async function expandEntryUrls(entries) {
  const cache = new Map();

  return Promise.all(
    entries.map(async (entry) => {
      if (!shouldExpandUrl(entry.url)) {
        return entry;
      }

      if (!cache.has(entry.url)) {
        cache.set(entry.url, expandUrl(entry.url));
      }

      return { ...entry, url: await cache.get(entry.url) };
    }),
  );
}

function shouldExpandUrl(url) {
  try {
    return SHORT_URL_HOST_RE.test(new URL(url).hostname);
  } catch (_error) {
    return false;
  }
}

async function expandUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });

    if (response.url && response.url !== url) {
      return response.url;
    }
  } catch (_error) {
    // Some destinations reject HEAD. Fall back to GET below.
  } finally {
    clearTimeout(timeout);
  }

  return expandUrlWithGet(url);
}

async function expandUrlWithGet(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    return response.url || url;
  } catch (_error) {
    return url;
  } finally {
    clearTimeout(timeout);
  }
}

function countExpanded(before, after) {
  return before.filter((entry, index) => entry.url !== after[index]?.url).length;
}

function readExistingPost(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, "utf8");
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (!frontmatterMatch) {
    return { preamble: "", body: content };
  }

  const body = content.slice(frontmatterMatch[0].length);
  const headingIndex = body.search(/^## /m);
  const preamble =
    headingIndex === -1 ? body.trim() : body.slice(0, headingIndex).trim();

  return {
    metadata: YAML.parse(frontmatterMatch[1]),
    preamble,
    body,
  };
}

function parseMarkdownEntries(markdown) {
  const entries = [];
  let category = "";

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);

    if (heading) {
      category = heading[1];
      continue;
    }

    const item = line.match(/^\s*[-*]\s+\[(.+)\]\(([^)]+)\)(?:\s+-\s+(.*))?\s*$/);

    if (item) {
      entries.push({
        title: item[1],
        url: item[2],
        description: item[3] || "",
        category,
      });
    }
  }

  return entries;
}

function mergeEntries(existingEntries, fetchedEntries) {
  const existingByUrl = existingEntries.reduce((ret, entry) => {
    ret[entry.url] = entry;

    return ret;
  }, {});

  return fetchedEntries.map((entry) => {
    const existing = existingByUrl[entry.url];

    if (!existing) {
      return entry;
    }

    return {
      title: existing.title || entry.title,
      url: entry.url,
      description: existing.description || "",
      category: existing.category || entry.category || "",
    };
  });
}

function sortEntries(entries, existingEntries) {
  const categoryOrder = getCategoryOrder(existingEntries);

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const categoryComparison = compareCategory(
        a.entry.category,
        b.entry.category,
        categoryOrder,
      );

      return categoryComparison || a.index - b.index;
    })
    .map((item) => item.entry);
}

function getCategoryOrder(entries) {
  const existingOrder = entries.reduce((order, entry) => {
    const category = normalizeCategory(entry.category);

    if (category && !order.includes(category)) {
      order.push(category);
    }

    return order;
  }, []);

  return CATEGORY_ORDER.reduce((order, category) => {
    const normalized = normalizeCategory(category);

    if (!order.includes(normalized)) {
      order.push(normalized);
    }

    return order;
  }, existingOrder);
}

function compareCategory(a, b, categoryOrder) {
  const normalizedA = normalizeCategory(a);
  const normalizedB = normalizeCategory(b);
  const indexA = categoryIndex(normalizedA, categoryOrder);
  const indexB = categoryIndex(normalizedB, categoryOrder);

  return indexA - indexB;
}

function categoryIndex(category, categoryOrder) {
  if (!category) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = categoryOrder.indexOf(category);

  return index === -1 ? Number.MAX_SAFE_INTEGER - 1 : index;
}

function normalizeCategory(category) {
  return (category || "").trim().toLowerCase();
}

function transformGitHubTitles(entries) {
  return entries.map((entry) => {
    const github = entry.title.match(/^github\.com\/([^/\s]+\/[^/\s]+)$/i);

    return github ? { ...entry, title: github[1] } : entry;
  });
}

function categorizeEntries(entries) {
  return entries.map((entry) => {
    if (entry.category) {
      return entry;
    }

    return { ...entry, category: categorizeEntry(entry) };
  });
}

function categorizeEntry(entry) {
  const text = `${entry.title} ${entry.description || ""} ${entry.url}`;
  const scores = CATEGORY_RULES.reduce((ret, rule) => {
    const matched = rule.patterns.filter((pattern) => pattern.test(text)).length;

    if (matched) {
      ret[rule.category] = (ret[rule.category] || 0) + matched * rule.weight;
    }

    return ret;
  }, {});

  addUrlScore(scores, entry.url);

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  return best?.[0] || fallbackCategory(entry.url);
}

function addUrlScore(scores, url) {
  const parsed = parseUrl(url);

  if (!parsed) {
    return;
  }

  if (GITHUB_HOST_RE.test(parsed.hostname)) {
    scores.Libraries = (scores.Libraries || 0) + 3;
  }

  if (ARTICLE_HOST_RE.test(parsed.hostname)) {
    scores.Articles = (scores.Articles || 0) + 2;
  }
}

function fallbackCategory(url) {
  const parsed = parseUrl(url);

  if (parsed && GITHUB_HOST_RE.test(parsed.hostname)) {
    return "Libraries";
  }

  return "Articles";
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch (_error) {
    return null;
  }
}

function renderPost({ number, title, preamble, entries }) {
  const groups = entries.reduce((ret, entry) => {
    const category = entry.category || DEFAULT_CATEGORY;

    if (!ret[category]) {
      ret[category] = [];
    }

    ret[category].push(entry);

    return ret;
  }, {});
  const body = Object.entries(groups)
    .map(([category, categoryEntries]) =>
      [`## ${titleCase(category)}`, "", categoryEntries.map(renderEntry).join("\n")].join(
        "\n",
      ),
    )
    .join("\n\n");

  return [
    "---",
    "type: static",
    `title: ${YAML.stringify(title).trim()}`,
    `short_title: ${YAML.stringify(`JSter #${number}`).trim()}`,
    "user: bebraw",
    `slug: jster-${number}`,
    "---",
    "",
    preamble,
    preamble ? "" : undefined,
    body,
    "",
  ]
    .filter((value) => value !== undefined)
    .join("\n");
}

function renderEntry(entry) {
  const description = entry.description ? ` - ${entry.description}` : "";

  return `- [${entry.title}](${entry.url})${description}`;
}

function titleCase(value) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function formatDate(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(" ");
}

function relative(filePath) {
  return filePath.replace(`${ROOT}/`, "");
}
