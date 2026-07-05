#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import YAML from "yaml";

const ROOT = process.cwd();
const BLOGPOSTS_DIR = join(ROOT, "data/blogposts");
const BLOG_INDEX_PATH = join(ROOT, "data/blogposts.json");
const CATEGORIES_DIR = join(ROOT, "data/categories");
const LIBRARIES_DIR = join(ROOT, "data/libraries");
const OUTPUT_PATH = join(ROOT, "reports/catalog-audit.json");
const FETCH_METADATA = process.argv.includes("--fetch-metadata");
const WRITE_REPORT = process.argv.includes("--write");
const JSON_OUTPUT = process.argv.includes("--json");
const LIMIT = readNumberArg("--limit", 60);
const IDS = readListArg("--id");
const CONCURRENCY = 12;
const REQUEST_TIMEOUT_MS = 12000;
const NOW = new Date();
const JS_KEYWORDS_RE =
  /\b(?:javascript|typescript|node(?:\.js)?|react|vue|angular|svelte|web|css|html|dom|browser|npm|package|library|framework|component|plugin|tool|cli|bundler|compiler|runtime|testing|test|ui|api|sdk|svg|canvas|wasm|webassembly)\b/i;

const libraries = loadLibraries().filter(
  (library) => !IDS.length || IDS.includes(library.id),
);
const categoriesByLibrary = loadCategoriesByLibrary();
const blogIndex = loadBlogIndex();
const blogReferences = loadBlogReferences(libraries);
const metadata = FETCH_METADATA ? await fetchMetadata(libraries) : new Map();
const audit = libraries
  .map((library) =>
    auditLibrary({
      library,
      categories: categoriesByLibrary.get(library.id) || [],
      references: blogReferences.get(library.id) || [],
      metadata: metadata.get(library.id) || {},
    }),
  )
  .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

if (WRITE_REPORT) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
}

if (JSON_OUTPUT) {
  console.log(JSON.stringify(audit.slice(0, LIMIT), null, 2));
} else {
  printSummary(audit.slice(0, LIMIT));
}

function loadLibraries() {
  return readdirSync(LIBRARIES_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(LIBRARIES_DIR, file), "utf8")));
}

function loadCategoriesByLibrary() {
  const ret = new Map();

  for (const file of readdirSync(CATEGORIES_DIR).filter((name) =>
    name.endsWith(".json"),
  )) {
    const category = file.replace(/\.json$/, "");
    const entries = JSON.parse(readFileSync(join(CATEGORIES_DIR, file), "utf8"));

    for (const entry of entries) {
      if (!ret.has(entry.id)) {
        ret.set(entry.id, []);
      }

      ret.get(entry.id).push(category);
    }
  }

  return ret;
}

function loadBlogIndex() {
  return JSON.parse(readFileSync(BLOG_INDEX_PATH, "utf8")).reduce((ret, entry) => {
    ret.set(entry.id, entry);

    return ret;
  }, new Map());
}

function loadBlogReferences(libraries) {
  const references = new Map(libraries.map((library) => [library.id, []]));
  const urlToId = new Map();

  for (const library of libraries) {
    for (const url of Object.values(library.links || {})) {
      const normalizedUrl = normalizeUrl(url);
      const normalizedPackageUrl = normalizePackageUrl(url);

      if (normalizedUrl) {
        urlToId.set(normalizedUrl, library.id);
      }

      if (normalizedPackageUrl) {
        urlToId.set(normalizedPackageUrl, library.id);
      }
    }
  }

  for (const file of readdirSync(BLOGPOSTS_DIR).sort(numericSort)) {
    const filePath = join(BLOGPOSTS_DIR, file);
    const post = parseBlogPost(readFileSync(filePath, "utf8"));
    const indexEntry = blogIndex.get(post.slug || "");

    for (const entry of extractEntries(post.body)) {
      const libraryId = resolveReferenceLibraryId(entry.url, urlToId);

      if (!libraryId || !references.has(libraryId)) {
        continue;
      }

      references.get(libraryId).push({
        file,
        slug: post.slug || "",
        date: indexEntry?.date || "",
        title: entry.title,
        url: entry.url,
        section: entry.section,
      });
    }
  }

  return references;
}

function auditLibrary({ library, categories, references, metadata }) {
  const reasons = [];
  const flags = [];
  let score = 0;
  const latestReference = getLatestReference(references);
  const referenceAgeYears = latestReference?.date
    ? ageInYears(new Date(latestReference.date))
    : undefined;
  const staleActivityYears = metadata.lastActivity
    ? ageInYears(new Date(metadata.lastActivity))
    : undefined;
  const text = [
    library.name,
    library.description,
    Object.values(library.links || {}).join(" "),
    (library.tags || []).join(" "),
    categories.join(" "),
  ].join(" ");

  if (!JS_KEYWORDS_RE.test(text)) {
    score += 20;
    reasons.push("weak JavaScript relevance signal");
  }

  if (references.length === 0) {
    score += 25;
    reasons.push("no blog post references found");
  } else if (referenceAgeYears >= 8) {
    score += 20;
    reasons.push(`latest blog reference is ${formatYears(referenceAgeYears)} old`);
  } else if (referenceAgeYears >= 5) {
    score += 10;
    reasons.push(`latest blog reference is ${formatYears(referenceAgeYears)} old`);
  } else if (referenceAgeYears <= 2) {
    score -= 15;
    flags.push("recently mentioned");
  }

  if (/^JavaScript project mentioned in\b/.test(library.description || "")) {
    score += 10;
    reasons.push("autogenerated description");
  }

  if ((library.logo || "") === "/images/repo.png") {
    score += 5;
    flags.push("generic logo");
  }

  if (!library.tags?.length) {
    score += 5;
    flags.push("no tags");
  }

  if (metadata.exists === false) {
    score += 50;
    reasons.push(`${metadata.source || "upstream"} missing`);
  }

  if (metadata.archived) {
    score += 40;
    reasons.push("GitHub repository archived");
  }

  if (metadata.deprecated) {
    score += 35;
    reasons.push("package is deprecated");
  }

  if (staleActivityYears >= 8) {
    score += 35;
    reasons.push(`upstream activity is ${formatYears(staleActivityYears)} old`);
  } else if (staleActivityYears >= 5) {
    score += 25;
    reasons.push(`upstream activity is ${formatYears(staleActivityYears)} old`);
  } else if (staleActivityYears >= 3) {
    score += 15;
    reasons.push(`upstream activity is ${formatYears(staleActivityYears)} old`);
  } else if (staleActivityYears !== undefined) {
    score -= 20;
    flags.push("recent upstream activity");
  }

  if (metadata.stars >= 1000) {
    score -= 20;
    flags.push(`${metadata.stars} GitHub stars`);
  } else if (metadata.stars >= 100) {
    score -= 10;
    flags.push(`${metadata.stars} GitHub stars`);
  }

  if (references.length >= 3) {
    score -= 10;
    flags.push(`${references.length} blog references`);
  }

  return {
    id: library.id,
    name: library.name,
    currentStatus: library.status || "",
    suggestedStatus: suggestedStatus(score, metadata),
    score,
    recommendation: recommendation(score),
    categories,
    reasons,
    flags,
    links: library.links || {},
    lastActivity: metadata.lastActivity || "",
    latestReference: latestReference?.date || "",
    references: references.map(({ file, date, title, url, section }) => ({
      file,
      date,
      section,
      title,
      url,
      replacement: url.startsWith(`/library/${library.id}`)
        ? "keep this internal link when marking stale"
        : "consider rewriting to the internal library page",
    })),
  };
}

function recommendation(score) {
  if (score >= 75) {
    return "mark stale or review for removal";
  }

  if (score >= 45) {
    return "review for stale status";
  }

  return "keep";
}

function suggestedStatus(score, metadata) {
  if (metadata.archived) {
    return "archived";
  }

  if (metadata.deprecated || score >= 75) {
    return "stale";
  }

  return "";
}

async function fetchMetadata(libraries) {
  const results = new Map();
  let index = 0;

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, libraries.length) }, async () => {
      while (index < libraries.length) {
        const library = libraries[index++];

        results.set(library.id, await fetchLibraryMetadata(library));
      }
    }),
  );

  return results;
}

async function fetchLibraryMetadata(library) {
  if (library.links?.github) {
    return fetchGitHubMetadata(library.links.github);
  }

  const npmUrl = Object.values(library.links || {}).find((url) =>
    /(^|\.)npmjs\.com$/i.test(parseUrl(url)?.hostname || ""),
  );

  if (npmUrl) {
    return fetchNpmMetadata(npmUrl);
  }

  return {};
}

async function fetchGitHubMetadata(url) {
  const parsed = parseUrl(url);

  if (!parsed || !/(^|\.)github\.com$/i.test(parsed.hostname)) {
    return {};
  }

  const [owner, repo] = parsed.pathname.replace(/^\/+/, "").split("/");

  if (!owner || !repo) {
    return {};
  }

  const result = await getJson(`https://api.github.com/repos/${owner}/${repo}`);

  if (result.status === 404) {
    return { exists: false, source: "GitHub repository" };
  }

  if (!result.body) {
    return {};
  }

  return {
    exists: true,
    source: "GitHub repository",
    archived: Boolean(result.body.archived),
    stars: result.body.stargazers_count || 0,
    lastActivity: result.body.pushed_at || result.body.updated_at || "",
  };
}

async function fetchNpmMetadata(url) {
  const packageName = parsePackageName(url);

  if (!packageName) {
    return {};
  }

  const result = await getJson(`https://registry.npmjs.org/${packageName}`);

  if (result.status === 404) {
    return { exists: false, source: "npm package" };
  }

  if (!result.body) {
    return {};
  }

  const latest = result.body["dist-tags"]?.latest;
  const latestVersion = latest ? result.body.versions?.[latest] : undefined;

  return {
    exists: true,
    source: "npm package",
    deprecated: Boolean(latestVersion?.deprecated),
    lastActivity: result.body.time?.modified || "",
  };
}

async function getJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = {
      Accept: "application/json",
      "User-Agent": "JSter catalog audit",
    };

    if (process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com/")) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: response.status, body: undefined };
    }

    return { status: response.status, body: await response.json() };
  } catch (_error) {
    return { status: 0, body: undefined };
  } finally {
    clearTimeout(timeout);
  }
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
      /^\s*[-*]\s+\[(.+)\]\(([^)]+)\)(?:\s+-\s+(.*))?\s*$/,
    );

    if (markdown) {
      entries.push({
        title: cleanTitle(markdown[1]),
        url: markdown[2].trim(),
        section,
      });
    }
  }

  return entries;
}

function resolveReferenceLibraryId(url, urlToId) {
  const internal = url.match(/^\/library\/([^/#?]+)/);

  if (internal) {
    return internal[1];
  }

  return urlToId.get(normalizeUrl(url)) || urlToId.get(normalizePackageUrl(url)) || "";
}

function getLatestReference(references) {
  return [...references]
    .filter((reference) => reference.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
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

function parseGitHubName(url) {
  const parsed = parseUrl(url);

  if (!parsed || !/(^|\.)github\.com$/i.test(parsed.hostname)) {
    return "";
  }

  const [owner, repo] = parsed.pathname.replace(/^\/+/, "").split("/");

  return owner && repo ? repo.replace(/\.git$/, "") : "";
}

function normalizeGitHubUrl(url) {
  const parsed = parseUrl(url);

  if (!parsed) {
    return url;
  }

  const [owner, repo] = parsed.pathname.replace(/^\/+/, "").split("/");

  return owner && repo ? `https://github.com/${owner}/${repo.replace(/\.git$/, "")}` : url;
}

function parsePackageName(url) {
  const parsed = parseUrl(url);

  if (!parsed) {
    return "";
  }

  if (/(^|\.)npmjs\.com$/i.test(parsed.hostname)) {
    return decodeURIComponent(parsed.pathname.replace(/^\/package\//, "")) || "";
  }

  if (/(^|\.)jsr\.io$/i.test(parsed.hostname)) {
    return parsed.pathname.replace(/^\/+/, "").split("/").slice(0, 2).join("/");
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

function cleanTitle(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function ageInYears(date) {
  return (NOW.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

function formatYears(value) {
  return `${value.toFixed(1)} years`;
}

function numericSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function readNumberArg(name, fallback) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const value = Number.parseInt(process.argv[index + 1], 10);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readListArg(name) {
  return process.argv
    .flatMap((arg, index) => {
      if (arg === name) {
        return process.argv[index + 1] || "";
      }

      if (arg.startsWith(`${name}=`)) {
        return arg.slice(name.length + 1);
      }

      return [];
    })
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function printSummary(items) {
  console.log(
    [
      "score | recommendation | id | refs | latest ref | reasons",
      "----- | -------------- | -- | ---- | ---------- | -------",
      ...items.map((item) =>
        [
          item.score,
          item.recommendation,
          item.suggestedStatus ? `${item.id} (${item.suggestedStatus})` : item.id,
          item.references.length,
          item.latestReference || "-",
          item.reasons.join("; ") || item.flags.join("; ") || "-",
        ].join(" | "),
      ),
    ].join("\n"),
  );

  if (WRITE_REPORT) {
    console.log(`\nWrote ${OUTPUT_PATH.replace(`${ROOT}/`, "")}`);
  }
}
