import YAML from "https://esm.sh/yaml@1.10.2";
import { configSync } from "https://deno.land/std@0.134.0/dotenv/mod.ts";
import { trim } from "https://deno.land/x/fae@v1.0.0/trim.ts";
import { pLimit } from "https://deno.land/x/p_limit@v1.0.0/mod.ts";
import { ensureFileSync } from "https://deno.land/std@0.141.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.141.0/path/mod.ts";
import getMarkdown from "./transforms/markdown.ts";
import { getJson } from "../scripts/utils.ts";
import type { LoadApi } from "https://deno.land/x/gustwind@v0.52.3/types.ts";

import categories from "../data/categories.json" assert {
  type: "json",
};
import blogIndex from "../data/blogposts.json" assert {
  type: "json",
};
import parentCategories from "../data/parent-categories.json" assert {
  type: "json",
};
import type { BlogPost, Category, Library, Tag } from "../types.ts";

type IndexEntry = { id: string; title: string; url: string; date: string };

type MarkdownWithFrontmatter = {
  data: {
    slug: string;
    title: string;
    date: Date;
    keywords: string[];
  };
  content: string;
};

const config = configSync();

const cacheDirectory = ".gustwind_cache";

function init({ load }: { load: LoadApi }) {
  const markdown = getMarkdown(load);

  async function indexBlog() {
    const blogPostFiles = await load.dir({
      path: "./data/blogposts",
      extension: ".yml",
      type: "",
    });
    const blogPosts: BlogPost[] = await Promise.all(blogPostFiles.map(
      async ({ name, path }) => {
        const yaml = YAML.parse(await load.textFile(path));

        return {
          name,
          path,
          ...yaml,
        };
      },
    ));

    const ret = blogIndex.map(({ id, date }: IndexEntry) => {
      const matchingBlogPost = blogPosts.find(({ slug }) => slug === id);

      if (!matchingBlogPost) {
        console.warn("No matching blog post found for", id);
      }

      return {
        // TODO: Better without nesting
        blogPost: {
          path: matchingBlogPost?.path,
          id,
          title: matchingBlogPost?.title || "",
          // @ts-ignore: Typo in the original data
          shortTitle: matchingBlogPost?.short_title,
          slug: matchingBlogPost?.slug || "",
          date,
          type: matchingBlogPost?.type || "static",
          user: matchingBlogPost?.user || "",
        },
      };
    });

    return ret.toReversed();
  }

  async function processBlogPost(blogPost: BlogPost) {
    const yaml = YAML.parse(await load.textFile(blogPost.path));

    return { ...blogPost, body: markdown(yaml.body).content };
  }

  async function indexLibraries() {
    const libraries = await getLibraries();

    return libraries.map((library) => ({ library }));
  }

  function processLibrary(library: Library) {
    return library;
  }

  // TODO: Extract the cache logic as it's useful beyond this use case.
  // That feels like a good spot for supporting middlewares or webpack style
  // loaders.
  async function getLibraries(): Promise<Library[]> {
    const libraries = await load.dir({
      path: "./data/libraries",
      extension: ".json",
      type: "",
    });
    const limit = pLimit(8);
    const enhancedLibraries = await Promise.all(
      await libraries.map(({ path }) =>
        limit(async () => {
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
              const cachedLibrary = JSON.parse(
                await load.textFile(cachePath),
              );

              return { stargazers: undefined, ...cachedLibrary };
            } catch (_error) {
              // no-op: Error here is ok as then it means the cache file doesn't exist yet
            }

            // It looks like the missing repos have stargazers set to undefined.
            try {
              const response = await fetch(
                `https://cf-api.jster.net/stargazers?organization=${
                  trim(org, "/")
                }&repository=${trim(repository, "/")}`,
                {
                  headers: {
                    "Authorization": `Bearer ${config.API_AUTH}`,
                  },
                },
              );
              const { stargazers } = await response.text().then((text) => {
                try {
                  return JSON.parse(text);
                } catch (_error) {
                  // no-op: Error is expected here as some libraries don't have this data
                  // because they aren't hosted on GitHub for example.
                }

                return 0;
              });

              if (stargazers === "undefined") {
                // Write to cache even if stargazers were not found
                ensureFileSync(cachePath);
                await Deno.writeTextFile(
                  cachePath,
                  JSON.stringify(
                    { ...library, stargazers: undefined },
                    null,
                    2,
                  ),
                );

                return;
              }

              const ret = {
                ...library,
                stargazers,
              };

              // Write to cache
              ensureFileSync(cachePath);
              await Deno.writeTextFile(cachePath, JSON.stringify(ret, null, 2));

              return ret;
            } catch (error) {
              console.error("Failed to get stargazers", error);

              return { ...library, stargazers: undefined };
            }
          }

          return { ...library, stargazers: undefined };
        })
      ),
    );

    return enhancedLibraries.filter(Boolean);
  }

  function indexCategories() {
    return categories.map((category) => ({ category }));
  }

  async function processCategory(category: Category) {
    const libraries = await getLibraries();

    return {
      ...category,
      libraries: (await getJson<Library[]>(
        `data/categories/${category.id}.json`,
      )).map((l) => libraries.find((library) => library.id === l.id)).filter(
        Boolean,
      ),
    };
  }

  function getParentCategories() {
    return parentCategories;
  }

  async function indexTags() {
    const libraries = await getLibraries();

    return Promise.all(
      (await load.dir({ path: "./data/tags", extension: ".json", type: "" }))
        .map(async (
          { name, path },
        ) => ({
          tag: {
            id: name.split(".").slice(0, -1).join(),
            title: name.split(".").slice(0, -1).join(),
            libraries: (await getJson<Category[]>(path)).map((c) => {
              const foundLibrary = libraries.find((l) => l.id === c.library.id);

              if (foundLibrary) {
                return foundLibrary;
              }
            }).filter(Boolean),
          },
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

export { init };
