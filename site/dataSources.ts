// TODO: Figure out a good spot for this. Maybe Gustwind needs some init file?
import { configSync } from "https://deno.land/std@0.134.0/dotenv/mod.ts";
import { trim } from "https://deno.land/x/fae@v1.0.0/trim.ts";
import { pLimit } from "https://deno.land/x/p_limit@v1.0.0/mod.ts";
import { ensureFileSync } from "https://deno.land/std@0.141.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.141.0/path/mod.ts";
import { Marked, Renderer } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import YAML from "https://esm.sh/yaml@1.10.2";
import { Html5Entities } from "https://deno.land/x/html_entities@v1.0/mod.js";
import { dir, getJson } from "../scripts/utils.ts";
import categories from "../assets/data/categories.json" assert {
  type: "json",
};
import blogIndex from "../assets/data/blogposts.json" assert {
  type: "json",
};
import parentCategories from "../assets/data/parent-categories.json" assert {
  type: "json",
};
import type { BlogPost, Category, Library } from "../types.ts";

type IndexEntry = { id: string; title: string; url: string; date: string };

// TODO: Set up highlighting
Marked.setOptions({
  renderer: new Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: true,
});

const config = configSync();

const cacheDirectory = ".gustwind_cache";

// TODO: Extract the cache logic as it's useful beyond this use case.
// That feels like a good spot for supporting middlewares or webpack style
// loaders.
async function getLibraries(): Promise<Library[]> {
  const libraries = await dir("./assets/data/libraries");
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
              await Deno.readTextFile(cachePath),
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
                JSON.stringify({ ...library, stargazers: undefined }, null, 2),
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

async function getBlogPosts() {
  const blogPosts: BlogPost[] = (await dir("./assets/data/blogposts")).map(
    ({ name, path }) => {
      const yaml = YAML.parse(Deno.readTextFileSync(path));

      return {
        name,
        path,
        ...yaml,
        // TODO: Support custom syntax (screenshots, anything else?)
        body: Html5Entities.decode(Marked.parse(yaml.body).content),
      };
    },
  );

  const ret = blogIndex.map(({ id, date }: IndexEntry) => {
    const matchingBlogPost = blogPosts.find(({ slug }) => slug === id);

    if (!matchingBlogPost) {
      console.warn("No matching blog post found for", id);
    }

    return {
      id,
      title: matchingBlogPost?.title || "",
      // @ts-ignore: Typo in the original data
      shortTitle: matchingBlogPost?.short_title,
      slug: matchingBlogPost?.slug || "",
      date,
      type: matchingBlogPost?.type || "static",
      user: matchingBlogPost?.user || "",
      body: matchingBlogPost?.body || "",
    };
  });

  // TODO: Likely this should be applied as a transform
  return [...ret].reverse();
}

async function getCategories() {
  const libraries = await getLibraries();

  return Promise.all(categories.map(async (
    category,
  ) => ({
    ...category,
    libraries: (await getJson<Library[]>(
      `assets/data/categories/${category.id}.json`,
    )).map((l) => libraries.find((library) => library.id === l.id)).filter(
      Boolean,
    ),
  })));
}

function getParentCategories() {
  return parentCategories;
}

async function getTags() {
  const libraries = await getLibraries();

  return Promise.all((await dir("assets/data/tags")).map(async (
    { name, path },
  ) => ({
    id: name.split(".").slice(0, -1).join(),
    title: name.split(".").slice(0, -1).join(),
    libraries: (await getJson<Category[]>(path)).map((c) => {
      const foundLibrary = libraries.find((l) => l.id === c.library.id);

      if (foundLibrary) {
        return foundLibrary;
      }
    }).filter(Boolean),
  })));
}

export {
  getBlogPosts as blogPosts,
  getCategories as categories,
  getLibraries as libraries,
  getParentCategories as parentCategories,
  getTags as tags,
};
