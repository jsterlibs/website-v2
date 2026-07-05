import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";

type BlogIndexEntry = { id: string; date?: string; url?: string };
type CategoryIndexEntry = { id: string };

const STATIC_PATHS = ["/", "/about/", "/blog/", "/catalog/", "/atom.xml"];

const plugin = {
  meta: {
    name: "jster-seo-plugin",
    description: "Writes robots.txt and a data-driven sitemap for static and ISR routes.",
    dependsOn: ["gustwind-meta-plugin"],
  },
  init({ cwd, outputDirectory }: { cwd: string; outputDirectory: string }) {
    return {
      finishBuild: async ({ send }: { send: Function }) => {
        const meta = await send("gustwind-meta-plugin", {
          type: "getMeta",
          payload: undefined,
        });
        const siteUrl = meta.url || "https://jster.net/";
        const sitemapXml = await buildSitemapXml({
          cwd,
          outputDirectory: path.join(cwd, outputDirectory),
          siteUrl,
        });

        return [
          {
            type: "writeTextFile",
            payload: {
              outputDirectory,
              file: "robots.txt",
              data: buildRobotsTxt(siteUrl),
            },
          },
          {
            type: "writeTextFile",
            payload: {
              outputDirectory,
              file: "sitemap.xml",
              data: sitemapXml,
            },
          },
        ];
      },
    };
  },
};

async function buildSitemapXml({
  cwd,
  outputDirectory,
  siteUrl,
}: {
  cwd: string;
  outputDirectory: string;
  siteUrl: string;
}) {
  const urls = new Map<string, { lastmod?: string }>();

  for (const pathname of STATIC_PATHS) {
    urls.set(pathname, {});
  }

  for (const pathname of await listPublicPaths(outputDirectory)) {
    if (pathname.startsWith("/tag/")) {
      continue;
    }

    urls.set(pathname, urls.get(pathname) || {});
  }

  for (const category of await readJson<CategoryIndexEntry[]>(
    path.join(cwd, "data/categories.json"),
  )) {
    urls.set(`/category/${category.id}/`, {});
  }

  for (const blogPost of await readJson<BlogIndexEntry[]>(
    path.join(cwd, "data/blogposts.json"),
  )) {
    urls.set(normalizePath(blogPost.url || `/blog/${blogPost.id}/`), {
      lastmod: blogPost.date,
    });
  }

  for (const libraryId of await listJsonIds(path.join(cwd, "data/libraries"))) {
    urls.set(`/library/${libraryId}/`, {});
  }

  const entries = [...urls.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pathname, { lastmod }]) =>
      [
        "  <url>",
        `    <loc>${escapeXml(urlJoin(siteUrl, pathname))}</loc>`,
        lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : "",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
  ].join("\n");
}

function buildRobotsTxt(siteUrl: string) {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${urlJoin(siteUrl, "sitemap.xml")}`,
    "",
  ].join("\n");
}

async function listPublicPaths(directoryPath: string, parentPath = ""): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const publicPaths: string[] = [];

  for (const entry of entries) {
    const relativePath = parentPath ? path.join(parentPath, entry.name) : entry.name;
    const absolutePath = path.join(directoryPath, entry.name);

    if (relativePath === "sitemap.xml") {
      continue;
    }

    if (entry.isDirectory()) {
      publicPaths.push(...(await listPublicPaths(absolutePath, relativePath)));
    } else if (entry.isFile() && isSitemapFile(entry.name)) {
      publicPaths.push(toSitemapPath(relativePath));
    }
  }

  return publicPaths;
}

async function listJsonIds(directoryPath: string) {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""));
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function isSitemapFile(fileName: string) {
  return fileName.endsWith(".html") || fileName.endsWith(".xml");
}

function toSitemapPath(filePath: string) {
  if (filePath.endsWith(".xml")) {
    return `/${filePath.replace(/^\/+/, "")}`;
  }

  return normalizePath(filePath.replace(/(^|\/)index\.html$/, "$1"));
}

function normalizePath(input: string) {
  if (input === "/") {
    return "/";
  }

  return `/${input.replace(/^\/+|\/+$/g, "")}/`;
}

function urlJoin(...parts: string[]) {
  return parts
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part.replace(/\/+$/, "") : part.replace(/^\/+|\/+$/g, ""),
    )
    .join("/");
}

function escapeXml(input = "") {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export { plugin };
