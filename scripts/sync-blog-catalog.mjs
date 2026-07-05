#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";

const ROOT = process.cwd();
const BLOGPOSTS_DIR = join(ROOT, "data/blogposts");
const CATEGORIES_DIR = join(ROOT, "data/categories");
const LIBRARIES_DIR = join(ROOT, "data/libraries");
const DEFAULT_CATEGORY = "toolkits";
const DRY_RUN = process.argv.includes("--dry-run");
const SAMPLE = process.argv.includes("--sample");
const EXPAND_SHORT_LINKS = process.argv.includes("--expand-short-links");
const LATEST_ONLY = process.argv.includes("--latest-only");
const REWRITE_EXPANDED_LINKS = process.argv.includes("--rewrite-expanded-links");
const REWRITE_CATALOG_LINKS = process.argv.includes("--rewrite-catalog-links");
const JS_KEYWORDS_RE =
  /\b(?:javascript|typescript|node(?:\.js)?|react|vue|angular|svelte|web|css|html|dom|browser|npm|package|library|framework|component|plugin|tool|cli|bundler|compiler|runtime|testing|test|ui|api|sdk)\b/i;
const CATALOG_SECTION_TO_CATEGORY = new Map([
  ["animation", "animation-libraries"],
  ["data manipulation", "data-structures"],
  ["data structures", "data-structures"],
  ["frameworks", "application-frameworks"],
  ["game engines", "game-engines"],
  ["games", "game-engines"],
  ["libraries", "toolkits"],
  ["runtimes", "serverside-libraries"],
  ["testing", "testing-frameworks"],
  ["tools", "build-utilities"],
  ["ui libraries", "ui-components"],
]);
const SKIP_SECTION_RE =
  /^(?:articles?|techniques?|tutorials?|guides?|news|reads?|benchmarks?|boilerplates?|demos?)$/i;
const ARTICLE_HOST_RE =
  /(^|\.)((?:blog|docs|developer|dev|engineering|learn)\.|medium\.com$|dev\.to$|hashnode\.dev$|substack\.com$|css-tricks\.com$|smashingmagazine\.com$|web\.dev$|2ality\.com$|frontendmasters\.com$)/i;
const PACKAGE_HOST_RE =
  /(^|\.)(github\.com|npmjs\.com|jsr\.io|deno\.land|bun\.sh)$/i;
const SHORT_URL_HOST_RE = /(^|\.)buff\.ly$|(^|\.)bit\.ly$|(^|\.)ilo\.im$/i;
const EXPAND_CONCURRENCY = 24;
const EXPAND_TIMEOUT_MS = 5000;

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

async function main() {
  const additions = await syncBlogCatalog({
    dryRun: DRY_RUN,
    expandShortLinks: EXPAND_SHORT_LINKS,
    latestOnly: LATEST_ONLY,
    rewriteExpandedLinks: REWRITE_EXPANDED_LINKS,
    rewriteCatalogLinks: REWRITE_CATALOG_LINKS,
  });

  if (DRY_RUN) {
    printSummary(additions);
    return;
  }
}

async function syncBlogCatalog({
  dryRun = false,
  expandShortLinks = false,
  latestOnly = false,
  rewriteExpandedLinks = false,
  rewriteCatalogLinks = false,
} = {}) {
  const existingLibraries = loadExistingLibraries();
  const { candidates, replacements } = await collectCandidates(existingLibraries, {
    expandShortLinks,
    latestOnly,
    rewriteExpandedLinks,
    rewriteCatalogLinks,
  });
  const additions = selectAdditions(candidates, existingLibraries);

  if (dryRun) {
    return additions;
  }

  await mkdir(LIBRARIES_DIR, { recursive: true });
  await Promise.all(
    additions.map((addition) =>
      writeFile(
        join(LIBRARIES_DIR, `${addition.library.id}.json`),
        JSON.stringify(addition.library),
      ),
    ),
  );
  await writeExpandedLinks(replacements);
  await writeCategoryEntries(additions);

  printSummary(additions);

  return additions;
}

async function collectCandidates(
  existingLibraries,
  {
    expandShortLinks = false,
    latestOnly = false,
    rewriteExpandedLinks = false,
    rewriteCatalogLinks = false,
  } = {},
) {
  const candidates = new Map();
  const candidateUrls = new Map();
  const expandCache = new Map();
  const replacements = new Map();
  const files = getBlogPostFiles({ latestOnly });
  const extractedEntries = [];

  for (const file of files) {
    const filePath = join(BLOGPOSTS_DIR, file);
    const content = readFileSync(filePath, "utf8");
    const post = parseBlogPost(content);

    if (!/^jster-\d+$/.test(post.slug || "")) {
      continue;
    }

    extractedEntries.push(
      ...extractEntries(post.body).map((entry) => ({ entry, file })),
    );
  }

  const entries = expandShortLinks
    ? await mapLimit(extractedEntries, EXPAND_CONCURRENCY, async ({ entry, file }) => ({
        entry: await expandEntryUrl(entry, expandCache, {
          file,
          replacements,
          rewriteExpandedLinks,
        }),
        file,
      }))
    : extractedEntries;

  for (const { entry, file } of entries) {
    if (!isCatalogCandidate(entry)) {
      continue;
    }

    const normalizedUrl = normalizeUrl(entry.url);
    const normalizedPackageUrl = normalizePackageUrl(entry.url);
    const existingLibraryId = resolveExistingLibraryId(
      entry,
      existingLibraries,
      normalizedUrl,
      normalizedPackageUrl,
    );
    const candidateLibraryId =
      candidateUrls.get(normalizedUrl) ||
      candidateUrls.get(normalizedPackageUrl) ||
      "";

    if (
      !normalizedUrl ||
      existingLibraryId ||
      candidateLibraryId
    ) {
      const libraryId = existingLibraryId || candidateLibraryId;

      if (rewriteCatalogLinks && libraryId) {
        addReplacement(replacements, file, entry.url, `/library/${libraryId}`);
      }

      continue;
    }

    const id = uniqueId(slugify(resolveName(entry)), existingLibraries.ids, candidates);

    if (!id) {
      continue;
    }

    if (rewriteCatalogLinks) {
      addReplacement(replacements, file, entry.url, `/library/${id}`);
    }

    candidates.set(id, {
      category: resolveCategory(entry.section),
      library: {
        id,
        description: resolveDescription(entry),
        logo: "/images/repo.png",
        name: resolveName(entry),
        links: resolveLinks(entry.url),
        tags: resolveTags(entry),
      },
      source: {
        post: file,
        section: entry.section,
      },
    });
    candidateUrls.set(normalizedUrl, id);

    if (normalizedPackageUrl) {
      candidateUrls.set(normalizedPackageUrl, id);
    }
  }

  return { candidates, replacements };
}

function selectAdditions(candidates, existingLibraries) {
  return [...candidates.values()].filter(
    ({ library }) =>
      library.id &&
      !existingLibraries.ids.has(library.id) &&
      !existingLibraries.names.has(normalizeName(library.name)),
  );
}

function getBlogPostFiles({ latestOnly = false } = {}) {
  const files = readdirSync(BLOGPOSTS_DIR).sort(numericSort);

  if (!latestOnly) {
    return files;
  }

  const latest = files
    .map((file) => {
      const match = file.match(/^(\d+)-jster-\d+\.(?:md|yml)$/);

      return match ? { file, number: Number.parseInt(match[1], 10) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.number - a.number)[0];

  return latest ? [latest.file] : [];
}

async function expandEntryUrl(
  entry,
  cache,
  { file = "", replacements, rewriteExpandedLinks = false } = {},
) {
  if (!shouldExpandUrl(entry.url)) {
    return entry;
  }

  if (!cache.has(entry.url)) {
    cache.set(entry.url, expandUrl(entry.url));
  }

  const expandedUrl = await cache.get(entry.url);

  if (rewriteExpandedLinks && file && expandedUrl !== entry.url) {
    addReplacement(replacements, file, entry.url, expandedUrl);
  }

  return expandedUrl === entry.url ? entry : { ...entry, url: expandedUrl };
}

function shouldExpandUrl(url) {
  const parsed = parseUrl(url);

  return parsed ? SHORT_URL_HOST_RE.test(parsed.hostname) : false;
}

async function expandUrl(url) {
  const headUrl = await fetchRedirectUrl(url, "HEAD");

  if (headUrl !== url) {
    return headUrl;
  }

  return fetchRedirectUrl(url, "GET");
}

async function fetchRedirectUrl(url, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXPAND_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
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

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function addReplacement(replacements, file, from, to) {
  if (!file || !from || !to || from === to) {
    return;
  }

  if (!replacements.has(file)) {
    replacements.set(file, []);
  }

  replacements.get(file).push({ from, to });
}

async function writeExpandedLinks(replacements) {
  await Promise.all(
    [...replacements.entries()].map(async ([file, fileReplacements]) => {
      const filePath = join(BLOGPOSTS_DIR, file);
      const content = readFileSync(filePath, "utf8");
      const nextContent = fileReplacements.reduce(
        (ret, { from, to }) => ret.split(from).join(to),
        content,
      );

      if (nextContent !== content) {
        await writeFile(filePath, nextContent);
      }
    }),
  );
}

function parseBlogPost(content) {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (frontmatterMatch) {
    return {
      ...YAML.parse(frontmatterMatch[1]),
      body: content.slice(frontmatterMatch[0].length),
    };
  }

  const parsed = YAML.parse(content);

  return { ...parsed, body: parsed.body || "" };
}

function extractEntries(body) {
  const entries = [];
  let section = "";

  for (const line of String(body || "").split(/\r?\n/)) {
    const heading = line.match(/^\s*#{1,3}\s+(.+?)\s*$/);

    if (heading) {
      section = heading[1].trim();
      continue;
    }

    const markdown = line.match(
      /^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)(?:\s+-\s+(.*))?\s*$/,
    );

    if (markdown) {
      entries.push({
        title: cleanTitle(markdown[1]),
        url: markdown[2].trim(),
        description: cleanDescription(markdown[3] || ""),
        section,
      });
      continue;
    }

    const html = line.match(
      /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>(?:\s*-\s*([^<]+))?/i,
    );

    if (html) {
      entries.push({
        title: cleanTitle(html[2]),
        url: html[1].trim(),
        description: cleanDescription(html[3] || ""),
        section,
      });
    }
  }

  return entries;
}

function isCatalogCandidate(entry) {
  if (!entry.title || !entry.url || isInternalUrl(entry.url)) {
    return false;
  }

  const parsed = parseUrl(entry.url);

  if (!parsed) {
    return false;
  }

  if (!isPackageUrl(parsed)) {
    return false;
  }

  if (!CATALOG_SECTION_TO_CATEGORY.has(normalizeSection(entry.section))) {
    return false;
  }

  if (SKIP_SECTION_RE.test(entry.section)) {
    return false;
  }

  return true;
}

function resolveCategory(section) {
  return CATALOG_SECTION_TO_CATEGORY.get(normalizeSection(section)) || DEFAULT_CATEGORY;
}

function resolveDescription(entry) {
  return (
    entry.description ||
    `JavaScript project mentioned in ${entry.section || "JSter"}.`
  );
}

function resolveLinks(url) {
  const parsed = parseUrl(url);

  if (parsed && /(^|\.)github\.com$/i.test(parsed.hostname)) {
    return { site: url, github: normalizeGitHubUrl(url) };
  }

  return { site: url };
}

function resolveTags(entry) {
  const tags = new Set();
  const section = normalizeSection(entry.section);

  if (section && section !== "libraries") {
    tags.add(section.replace(/\s+/g, "-"));
  }

  if (/react/i.test(`${entry.title} ${entry.description}`)) {
    tags.add("react");
  }

  if (/typescript/i.test(`${entry.title} ${entry.description}`)) {
    tags.add("typescript");
  }

  return [...tags];
}

function resolveName(entry) {
  const githubName = parseGitHubName(entry.url);
  const packageName = parsePackageName(entry.url);

  if (githubName) {
    return githubName;
  }

  if (packageName) {
    return packageName;
  }

  return entry.title;
}

function resolveExistingLibraryId(
  entry,
  existingLibraries,
  normalizedUrl,
  normalizedPackageUrl,
) {
  return (
    existingLibraries.urlToId.get(normalizedUrl) ||
    existingLibraries.urlToId.get(normalizedPackageUrl) ||
    existingLibraries.nameToId.get(normalizeName(resolveName(entry))) ||
    ""
  );
}

function loadExistingLibraries() {
  const ids = new Set();
  const names = new Set();
  const urls = new Set();
  const nameToId = new Map();
  const urlToId = new Map();

  for (const file of readdirSync(LIBRARIES_DIR)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const library = JSON.parse(readFileSync(join(LIBRARIES_DIR, file), "utf8"));

    ids.add(file.replace(/\.json$/, ""));
    ids.add(library.id);
    names.add(normalizeName(library.name));
    nameToId.set(normalizeName(library.name), library.id);

    for (const value of Object.values(library.links || {})) {
      const normalizedUrl = normalizeUrl(value);

      if (normalizedUrl) {
        urls.add(normalizedUrl);
        urlToId.set(normalizedUrl, library.id);
      }

      const normalizedPackageUrl = normalizePackageUrl(value);

      if (normalizedPackageUrl) {
        urls.add(normalizedPackageUrl);
        urlToId.set(normalizedPackageUrl, library.id);
      }
    }
  }

  return { ids, names, urls, nameToId, urlToId };
}

async function writeCategoryEntries(additions) {
  const additionsByCategory = additions.reduce((ret, addition) => {
    if (!ret.has(addition.category)) {
      ret.set(addition.category, []);
    }

    ret.get(addition.category).push(addition);

    return ret;
  }, new Map());

  await Promise.all(
    [...additionsByCategory.entries()].map(async ([category, categoryAdditions]) => {
      const filePath = join(CATEGORIES_DIR, `${category}.json`);
      const entries = existsSync(filePath)
        ? JSON.parse(readFileSync(filePath, "utf8"))
        : [];
      const existingIds = new Set(entries.map((entry) => entry.id));
      const nextEntries = entries.concat(
        categoryAdditions
          .filter(({ library }) => !existingIds.has(library.id))
          .map(({ library }) => ({
            title: library.name,
            url: `/library/${library.id}`,
            id: library.id,
            library,
          })),
      );

      await writeFile(filePath, JSON.stringify(nextEntries));
    }),
  );
}

function uniqueId(baseId, existingIds, candidates) {
  if (!baseId) {
    return "";
  }

  let id = baseId;
  let index = 2;

  while (existingIds.has(id) || candidates.has(id)) {
    id = `${baseId}-${index}`;
    index += 1;
  }

  return id;
}

function parseGitHubName(url) {
  const parsed = parseUrl(url);

  if (!parsed || !/(^|\.)github\.com$/i.test(parsed.hostname)) {
    return "";
  }

  const [owner, repo] = parsed.pathname.replace(/^\/+/, "").split("/");

  if (!owner || !repo) {
    return "";
  }

  const cleanRepo = repo.replace(/\.git$/, "");

  return isGenericRepoName(cleanRepo) ? `${owner}-${cleanRepo}` : cleanRepo;
}

function parsePackageName(url) {
  const parsed = parseUrl(url);

  if (!parsed) {
    return "";
  }

  if (/(^|\.)npmjs\.com$/i.test(parsed.hostname)) {
    return parsed.pathname.replace(/^\/package\//, "").split("/")[0] || "";
  }

  if (/(^|\.)jsr\.io$/i.test(parsed.hostname)) {
    return parsed.pathname.replace(/^\/+/, "").split("/").slice(0, 2).join("/");
  }

  return "";
}

function normalizeGitHubUrl(url) {
  const parsed = parseUrl(url);

  if (!parsed) {
    return url;
  }

  const [owner, repo] = parsed.pathname.replace(/^\/+/, "").split("/");

  return owner && repo ? `https://github.com/${owner}/${repo.replace(/\.git$/, "")}` : url;
}

function normalizeUrl(url) {
  const parsed = parseUrl(url);

  if (!parsed) {
    return "";
  }

  parsed.hash = "";
  parsed.search = "";

  return parsed.toString().replace(/\/$/, "").toLowerCase();
}

function normalizePackageUrl(url) {
  const githubUrl = parseGitHubName(url) ? normalizeGitHubUrl(url) : "";

  if (githubUrl) {
    return normalizeUrl(githubUrl);
  }

  const packageName = parsePackageName(url);

  if (!packageName) {
    return "";
  }

  const parsed = parseUrl(url);

  if (!parsed) {
    return "";
  }

  if (/(^|\.)npmjs\.com$/i.test(parsed.hostname)) {
    return normalizeUrl(`https://www.npmjs.com/package/${packageName}`);
  }

  if (/(^|\.)jsr\.io$/i.test(parsed.hostname)) {
    return normalizeUrl(`https://jsr.io/${packageName}`);
  }

  return "";
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch (_error) {
    return null;
  }
}

function isInternalUrl(url) {
  return url.startsWith("/") || url.startsWith("#") || url.startsWith("mailto:");
}

function cleanTitle(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescription(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return cleanTitle(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeSection(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function numericSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function printSummary(additions) {
  const byCategory = additions.reduce((ret, addition) => {
    ret[addition.category] = (ret[addition.category] || 0) + 1;

    return ret;
  }, {});

  console.log(`Catalog additions: ${additions.length}`);

  for (const [category, count] of Object.entries(byCategory).sort()) {
    console.log(`- ${category}: ${count}`);
  }

  if (SAMPLE) {
    console.log("");
    for (const addition of additions.slice(0, 80)) {
      console.log(
        [
          addition.category,
          addition.library.id,
          addition.library.name,
          addition.library.links.github || addition.library.links.site,
          addition.source.post,
          addition.source.section,
        ].join(" | "),
      );
    }
  }
}

function isPackageUrl(parsed) {
  return PACKAGE_HOST_RE.test(parsed.hostname);
}

function isLikelyArticle(entry) {
  return /(?:article|blog|guide|tutorial|explainer|interview|newsletter|release|announcement)/i.test(
    `${entry.title} ${entry.description}`,
  ) || /\b(?:introducing|v?\d+\.\d+(?:\.\d+)?|version\s+\d+|released?|available|is here)\b/i.test(
    entry.title,
  );
}

function isGenericRepoName(name) {
  return /^(?:app|cli|core|demo|docs?|js|lib|pkg|utils?|web|s)$/i.test(name);
}

export { syncBlogCatalog };
