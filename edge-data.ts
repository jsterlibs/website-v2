import type { BlogPost, Category, Library, Tag } from "./types.ts";

const RAW_BASE =
  "https://raw.githubusercontent.com/jsterlibs/website-v2/main/";
const DEFAULT_PAGE_SIZE = 100;
const SITE_URL = "https://jster.net";

type CategoryIndexEntry = Pick<Category, "id" | "title" | "url">;
type CategoryLibraryEntry = {
  id: string;
  title: string;
  url: string;
  library: Library;
};
type BlogIndexEntry = Pick<BlogPost, "id" | "title" | "url" | "date">;
type JsonAssetSource = { fetch: typeof fetch };

function fetchJson<T>(path: string, assets?: JsonAssetSource): Promise<T> {
  const jsonRequest = assets
    ? new Request(new URL(`/${path}`, SITE_URL).toString())
    : RAW_BASE + path;
  const jsonFetch = assets ? assets.fetch.bind(assets) : fetch;

  return jsonFetch(jsonRequest).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }

    return response.json<T>();
  });
}

async function getCategory(
  id: string,
  {
    assets,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    pathname = `/category/${id}/`,
  }: {
    assets?: JsonAssetSource;
    page?: number;
    pageSize?: number;
    pathname?: string;
  } = {},
) {
  const categories = await fetchJson<CategoryIndexEntry[]>(
    "data/categories.json",
    assets,
  );
  const catalogPage = await getCategoryLibraries(
    "category",
    id,
    page,
    pageSize,
    assets,
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
  {
    assets,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    pathname = `/tag/${id}/`,
  }: {
    assets?: JsonAssetSource;
    page?: number;
    pageSize?: number;
    pathname?: string;
  } = {},
) {
  const catalogPage = await getCategoryLibraries(
    "tag",
    id,
    page,
    pageSize,
    assets,
  );

  return {
    ...catalogPage,
    title: id,
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
  assets?: JsonAssetSource,
) {
  const path =
    type === "tag" ? `data/tags/${id}.json` : `data/categories/${id}.json`;
  const entries = await fetchJson<CategoryLibraryEntry[]>(path, assets);
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

async function getBlogPosts(assets?: JsonAssetSource) {
  const blogPosts = await fetchJson<BlogIndexEntry[]>(
    "data/blogposts.json",
    assets,
  );

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
    qualitySortValue(a) - qualitySortValue(b) ||
    a.name.localeCompare(b.name)
  );
}

function qualitySortValue(library: Library) {
  let score = 0;

  if (/^JavaScript project mentioned in\b/.test(library.description || "")) {
    score += 2;
  }

  if ((library.logo || "") === "/images/repo.png") {
    score += 1;
  }

  if (!library.links?.site && !library.links?.github) {
    score += 1;
  }

  return score;
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
