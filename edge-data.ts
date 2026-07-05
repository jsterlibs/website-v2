import type { BlogPost, Category, Library, Tag } from "./types.ts";

const RAW_BASE =
  "https://raw.githubusercontent.com/jsterlibs/website-v2/main/";
const DEFAULT_PAGE_SIZE = 100;

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
  const categories = await fetchJson<CategoryIndexEntry[]>(
    "data/categories.json",
  );
  const category = categories.find((entry) => entry.id === id);

  if (!category) {
    throw new Error(`Unknown category ${id}`);
  }

  return {
    ...category,
    libraries: [],
    pageSize: DEFAULT_PAGE_SIZE,
    sourceType: "category",
  };
}

async function getTag(id: string) {
  return {
    id,
    title: id,
    libraries: [],
    pageSize: DEFAULT_PAGE_SIZE,
    sourceType: "tag",
  };
}

async function getCategoryLibraries(
  type: "category" | "tag",
  id: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
) {
  const path =
    type === "tag" ? `data/tags/${id}.json` : `data/categories/${id}.json`;
  const entries = await fetchJson<CategoryLibraryEntry[]>(path);
  const libraries = entries
    .map(({ library }) => library)
    .sort(compareLibrariesForIndex);
  const totalLibraries = libraries.length;
  const boundedPageSize = Math.min(Math.max(pageSize, 1), DEFAULT_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(totalLibraries / boundedPageSize));
  const boundedPage = Math.min(Math.max(page, 1), pageCount);
  const start = (boundedPage - 1) * boundedPageSize;

  return {
    id,
    page: boundedPage,
    pageSize: boundedPageSize,
    pageCount,
    totalLibraries,
    libraries: libraries.slice(start, start + boundedPageSize),
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

function compareLibrariesForIndex(a: Library, b: Library) {
  return (
    statusSortValue(a.status) - statusSortValue(b.status) ||
    a.name.localeCompare(b.name)
  );
}

function statusSortValue(status?: Library["status"]) {
  return status ? 1 : 0;
}

export { getBlogPosts, getCategory, getCategoryLibraries, getTag };
