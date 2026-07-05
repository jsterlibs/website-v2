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

async function getCategory(
  id: string,
  {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    pathname = `/category/${id}/`,
  } = {},
) {
  const categories = await fetchJson<CategoryIndexEntry[]>(
    "data/categories.json",
  );
  const catalogPage = await getCategoryLibraries(
    "category",
    id,
    page,
    pageSize,
  );
  const category = categories.find((entry) => entry.id === id);

  if (!category) {
    throw new Error(`Unknown category ${id}`);
  }

  return {
    ...category,
    ...catalogPage,
    hasLibraries: catalogPage.libraries.length > 0,
    sourceType: "category",
    ...getPaginationUrls(pathname, catalogPage.page, catalogPage.pageCount),
  };
}

async function getTag(
  id: string,
  { page = 1, pageSize = DEFAULT_PAGE_SIZE, pathname = `/tag/${id}/` } = {},
) {
  const catalogPage = await getCategoryLibraries("tag", id, page, pageSize);

  return {
    id,
    title: id,
    ...catalogPage,
    hasLibraries: catalogPage.libraries.length > 0,
    sourceType: "tag",
    ...getPaginationUrls(pathname, catalogPage.page, catalogPage.pageCount),
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

function getPaginationUrls(pathname: string, page: number, pageCount: number) {
  return {
    hasPagination: pageCount > 1,
    previousPageUrl: page > 1 ? pageUrl(pathname, page - 1) : "",
    nextPageUrl: page < pageCount ? pageUrl(pathname, page + 1) : "",
  };
}

function pageUrl(pathname: string, page: number) {
  if (page <= 1) {
    return pathname;
  }

  return `${pathname}?page=${page}`;
}

export { getBlogPosts, getCategory, getCategoryLibraries, getTag };
