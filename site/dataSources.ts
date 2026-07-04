import { join } from "node:path";
import { raw } from "gustwind/htmlisp";
import YAML from "yaml";
import getMarkdown from "./transforms/markdown.ts";
import { getJson, getJsonSync } from "../scripts/utils.ts";
import type { LoadApi } from "gustwind";

import type { BlogPost, Category, Library, Tag } from "../types.ts";

type IndexEntry = { id: string; title: string; url: string; date: string };
type BlogPostFile = {
  name: string;
  path: string;
};
type IndexedBlogPost = BlogPost & {
  bodyHtml: ReturnType<typeof raw>;
};

const cacheDirectory = ".gustwind_cache";
const categories = getJsonSync<Category[]>("data/categories.json");
const blogIndex = getJsonSync<IndexEntry[]>("data/blogposts.json");
const parentCategories = getJsonSync("data/parent-categories.json");

function parseBlogPostFile(content: string, path: string) {
  if (path.endsWith(".md")) {
    const frontmatterMatch = content.match(
      /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
    );

    if (!frontmatterMatch) {
      throw new Error(`Missing frontmatter in ${path}`);
    }

    return {
      ...YAML.parse(frontmatterMatch[1]),
      body: content.slice(frontmatterMatch[0].length),
    };
  }

  return YAML.parse(content);
}

function init({ load }: { load: LoadApi }) {
  const markdown = getMarkdown(load);
  let blogPostsPromise: Promise<IndexedBlogPost[]> | undefined;
  let librariesPromise: Promise<Library[]> | undefined;
  let librariesByIdPromise: Promise<Map<string, Library>> | undefined;

  function indexBlog() {
    if (blogPostsPromise) {
      return blogPostsPromise;
    }

    blogPostsPromise = loadBlogPosts();

    return blogPostsPromise;
  }

  async function loadBlogPosts() {
    const blogPostFiles: BlogPostFile[] = [
      ...(await load.dir({
        path: "./data/blogposts",
        extension: ".yml",
        type: "",
      })),
      ...(await load.dir({
        path: "./data/blogposts",
        extension: ".md",
        type: "",
      })),
    ];
    const blogPosts: BlogPost[] = await Promise.all(
      blogPostFiles.map(async ({ name, path }) => {
        const blogPost = parseBlogPostFile(await load.textFile(path), path);

        return {
          name,
          path,
          ...blogPost,
        };
      }),
    );

    return (
      await Promise.all(
        blogIndex.map(async ({ id, url, date }: IndexEntry) => {
          const matchingBlogPost = blogPosts.find(({ slug }) => slug === id);
          const bodySource = matchingBlogPost?.body || "";
          const body = markdown(bodySource).content;

          if (!matchingBlogPost) {
            console.warn("No matching blog post found for", id);
          }

          return {
            path: matchingBlogPost?.path,
            id,
            url,
            title: matchingBlogPost?.title || "",
            titleHtml: raw(escapeHtml(matchingBlogPost?.title || "")),
            // @ts-ignore: Typo in the original data
            shortTitle: matchingBlogPost?.short_title,
            slug: matchingBlogPost?.slug || "",
            date,
            type: matchingBlogPost?.type || "static",
            user: matchingBlogPost?.user || "",
            // This is needed for RSS
            body,
            bodyHtml: raw(body),
          };
        }),
      )
    ).toReversed();
  }

  function processBlogPost(blogPost: BlogPost) {
    if ("bodyHtml" in blogPost) {
      return blogPost;
    }

    return { ...blogPost, bodyHtml: raw(markdown(blogPost.body || "").content) };
  }

  function indexLibraries() {
    return getLibraries();
  }

  function processLibrary(library: Library) {
    return library;
  }

  // TODO: Extract the cache logic as it's useful beyond this use case.
  // That feels like a good spot for supporting middlewares or webpack style
  // loaders.
  async function getLibraries(): Promise<Library[]> {
    if (librariesPromise) {
      return librariesPromise;
    }

    librariesPromise = loadLibraries();

    return librariesPromise;
  }

  async function getLibrariesById(): Promise<Map<string, Library>> {
    if (librariesByIdPromise) {
      return librariesByIdPromise;
    }

    librariesByIdPromise = getLibraries().then(
      (libraries) => new Map(libraries.map((library) => [library.id, library])),
    );

    return librariesByIdPromise;
  }

  async function loadLibraries(): Promise<Library[]> {
    const libraries = await load.dir({
      path: "./data/libraries",
      extension: ".json",
      type: "",
    });
    const enhancedLibraries = await Promise.all(
      await libraries.map(async ({ path }) => {
        const library = await getJson<Library>(path);

        if (library.links.github) {
          const parts = library.links.github?.split("github.com/")[1];
          const [org, repository] = parts.split("/");

          if (!org || !repository) {
            return library;
          }

          // Check cache before requesting
          const cachePath = join(cacheDirectory, library.name + ".json");

          try {
            const cachedLibrary = JSON.parse(await load.textFile(cachePath));

            return { stargazers: undefined, ...cachedLibrary };
          } catch (_error) {
            // no-op: Error here is ok as then it means the cache file doesn't exist yet
          }

          return { ...library, stargazers: undefined };
        }

        return { ...library, stargazers: undefined };
      }),
    );

    return enhancedLibraries.filter(Boolean);
  }

  function indexCategories() {
    return categories;
  }

  async function processCategory(category: Category) {
    const librariesById = await getLibrariesById();

    return {
      ...category,
      libraries: (
        await getJson<Library[]>(`data/categories/${category.id}.json`)
      )
        .map((l) => librariesById.get(l.id))
        .filter(Boolean),
    };
  }

  function getParentCategories() {
    return parentCategories;
  }

  async function indexTags() {
    const librariesById = await getLibrariesById();

    return Promise.all(
      (
        await load.dir({ path: "./data/tags", extension: ".json", type: "" })
      ).map(async ({ name, path }) => ({
        id: name.split(".").slice(0, -1).join(),
        title: name.split(".").slice(0, -1).join(),
        libraries: (await getJson<Category[]>(path))
          .map((c) => {
            const foundLibrary = librariesById.get(c.library.id);

            if (foundLibrary) {
              return foundLibrary;
            }
          })
          .filter(Boolean),
      })),
    );
  }

  function processTag(tag: Tag) {
    return tag;
  }

  return {
    getParentCategories,
    indexLibraries,
    indexCategories,
    indexBlog,
    indexTags,
    processLibrary,
    processBlogPost,
    processCategory,
    processTag,
  };
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export { init };
