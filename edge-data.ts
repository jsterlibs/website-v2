import type { BlogPost, Category, Library, Tag } from "./types.ts";

const RAW_BASE =
  "https://raw.githubusercontent.com/jsterlibs/website-v2/main/";

type CategoryIndexEntry = Pick<Category, "id" | "title" | "url">;
type CategoryLibraryEntry = {
  id: string;
  title: string;
  url: string;
  library: Library;
};
type BlogIndexEntry = Pick<BlogPost, "id" | "title" | "url" | "date">;

const jsonCache = new Map<string, Promise<unknown>>();

function fetchJson<T>(path: string): Promise<T> {
  const cached = jsonCache.get(path);
  if (cached) {
    return cached as Promise<T>;
  }

  const promise = fetch(RAW_BASE + path).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }

    return response.json();
  });

  jsonCache.set(path, promise);

  return promise as Promise<T>;
}

async function getCategory(id: string) {
  const [categories, libraries] = await Promise.all([
    fetchJson<CategoryIndexEntry[]>("data/categories.json"),
    fetchJson<CategoryLibraryEntry[]>(`data/categories/${id}.json`),
  ]);
  const category = categories.find((entry) => entry.id === id);

  if (!category) {
    throw new Error(`Unknown category ${id}`);
  }

  return {
    ...category,
    libraries: libraries.map(({ library }) => library),
  };
}

async function getTag(id: string): Promise<Tag> {
  const libraries = await fetchJson<CategoryLibraryEntry[]>(
    `data/tags/${id}.json`,
  );

  return {
    id,
    title: id,
    libraries: libraries.map(({ library }) => library),
  };
}

async function getBlogPosts() {
  const blogPosts = await fetchJson<BlogIndexEntry[]>("data/blogposts.json");

  return blogPosts
    .map((blogPost) => ({
      ...blogPost,
      titleHtml: blogPost.title,
    }))
    .toReversed();
}

export { getBlogPosts, getCategory, getTag };
