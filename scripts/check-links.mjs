#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, normalize } from "node:path";

const ROOT = process.cwd();
const BUILD_DIR = join(ROOT, "build");
const DATA_DIR = join(ROOT, "data");
const CHECK_EXTERNAL = process.argv.includes("--external");
const CONCURRENCY = 12;
const REQUEST_TIMEOUT_MS = 15000;
const DEFINITE_DEAD_STATUSES = new Set([404, 410]);

const htmlFiles = listFiles(BUILD_DIR).filter((file) => file.endsWith(".html"));
const internalFailures = [];
const externalUrls = new Map();

for (const filePath of htmlFiles) {
  const html = readFileSync(filePath, "utf8");
  const links = extractLinks(html);

  for (const link of links) {
    if (isIgnorableLink(link)) {
      continue;
    }

    if (isExternalLink(link)) {
      addExternalUrl(link, filePath);
      continue;
    }

    const resolved = resolveInternalLink(link, filePath);
    const failure = validateInternalPath(resolved);

    if (failure) {
      internalFailures.push({
        file: relative(filePath),
        link,
        reason: failure,
      });
    }
  }
}

if (internalFailures.length) {
  console.error(`Internal link failures: ${internalFailures.length}`);

  for (const failure of internalFailures.slice(0, 100)) {
    console.error(`- ${failure.file}: ${failure.link} (${failure.reason})`);
  }

  if (internalFailures.length > 100) {
    console.error(`... ${internalFailures.length - 100} more`);
  }
}

let externalFailures = [];

if (CHECK_EXTERNAL) {
  externalFailures = await checkExternalUrls([...externalUrls.keys()]);

  if (externalFailures.length) {
    console.error(`External 404/410 failures: ${externalFailures.length}`);

    for (const failure of externalFailures.slice(0, 100)) {
      const sources = externalUrls.get(failure.url).slice(0, 3).join(", ");

      console.error(`- ${failure.status} ${failure.url} (${sources})`);
    }

    if (externalFailures.length > 100) {
      console.error(`... ${externalFailures.length - 100} more`);
    }
  }
}

if (internalFailures.length || externalFailures.length) {
  process.exit(1);
}

console.log(`Checked ${htmlFiles.length} HTML files.`);
console.log("Internal link failures: 0");

if (CHECK_EXTERNAL) {
  console.log(`External URLs checked: ${externalUrls.size}`);
  console.log("External 404/410 failures: 0");
}

function extractLinks(html) {
  const links = [];
  const attributePattern = /\s(?:href|src)=["']([^"']+)["']/gi;
  let match;

  while ((match = attributePattern.exec(html))) {
    links.push(decodeHtml(match[1]));
  }

  return links;
}

function isIgnorableLink(link) {
  return (
    !link ||
    link.startsWith("#") ||
    /^(?:mailto|tel|javascript|data):/i.test(link)
  );
}

function isExternalLink(link) {
  return /^https?:\/\//i.test(link);
}

function addExternalUrl(link, filePath) {
  const normalizedUrl = normalizeExternalUrl(link);

  if (!normalizedUrl) {
    return;
  }

  if (!externalUrls.has(normalizedUrl)) {
    externalUrls.set(normalizedUrl, []);
  }

  externalUrls.get(normalizedUrl).push(relative(filePath));
}

function resolveInternalLink(link, filePath) {
  const url = parseInternalUrl(link);

  if (link.startsWith("/")) {
    return url.pathname;
  }

  const fileDirectory = dirname(relative(filePath).replace(/^build\//, ""));
  const baseDirectory = fileDirectory.endsWith("index.html")
    ? dirname(fileDirectory)
    : fileDirectory;

  return normalize(`/${baseDirectory}/${url.pathname}`).replace(/\\/g, "/");
}

function validateInternalPath(pathname) {
  const cleanPath = normalizePathname(pathname);

  if (cleanPath === "/") {
    return fileExists("index.html") ? "" : "missing build/index.html";
  }

  if (cleanPath.startsWith("/library/")) {
    const id = pathSegment(cleanPath, "library");

    return dataFileExists("libraries", id) ? "" : `missing data/libraries/${id}.json`;
  }

  if (cleanPath.startsWith("/category/")) {
    const id = pathSegment(cleanPath, "category");

    return dataFileExists("categories", id) ? "" : `missing data/categories/${id}.json`;
  }

  if (cleanPath.startsWith("/tag/")) {
    const id = pathSegment(cleanPath, "tag");

    return dataFileExists("tags", id) ? "" : `missing data/tags/${id}.json`;
  }

  if (fileExists(cleanPath.replace(/^\/+/, ""))) {
    return "";
  }

  const htmlPath = cleanPath.endsWith("/")
    ? `${cleanPath.replace(/^\/+/, "")}index.html`
    : `${cleanPath.replace(/^\/+/, "")}/index.html`;

  return fileExists(htmlPath) ? "" : `missing build/${htmlPath}`;
}

function parseInternalUrl(link) {
  return new URL(link, "https://jster.net/");
}

function normalizePathname(pathname) {
  const decoded = decodeURIComponent(pathname);

  return decoded.startsWith("/") ? decoded : `/${decoded}`;
}

function pathSegment(pathname, base) {
  const [segment] = pathname
    .replace(new RegExp(`^/${base}/?`), "")
    .replace(/\/.*$/, "")
    .split("/");

  return segment || "";
}

function fileExists(pathname) {
  return existsSync(join(BUILD_DIR, pathname));
}

function dataFileExists(type, id) {
  return Boolean(id) && existsSync(join(DATA_DIR, type, `${id}.json`));
}

async function checkExternalUrls(urls) {
  const failures = [];
  let index = 0;

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
      while (index < urls.length) {
        const url = urls[index++];
        const result = await checkExternalUrl(url);

        if (DEFINITE_DEAD_STATUSES.has(result.status)) {
          failures.push({ url, status: result.status });
        }
      }
    }),
  );

  return failures.sort((a, b) => a.url.localeCompare(b.url));
}

async function checkExternalUrl(url) {
  const head = await request(url, "HEAD");

  if (head.status && ![405, 501].includes(head.status)) {
    return head;
  }

  return request(url, "GET");
}

async function request(url, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "JSter link checker",
      },
    });

    return { status: response.status };
  } catch (_error) {
    return { status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeExternalUrl(url) {
  try {
    const parsed = new URL(url);

    parsed.hash = "";

    return parsed.toString();
  } catch (_error) {
    return "";
  }
}

function listFiles(directoryPath) {
  if (!existsSync(directoryPath)) {
    return [];
  }

  return readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directoryPath, entry.name);

    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function relative(filePath) {
  return filePath.replace(`${ROOT}/`, "");
}
