import {
  getBlogPosts,
  getCategory,
  getCategoryLibraries,
  getTag,
} from "./edge-data.ts";
import { render } from "./render.ts";
import { ZLibrary, type Library } from "./types.ts";

type WorkerEnv = {
  API_AUTH?: string;
  ASSETS: {
    fetch: typeof fetch;
  };
};

type CatalogSource = "category" | "tag";

const ONE_HOUR = 60 * 60;
const ONE_DAY = ONE_HOUR * 24;
const ONE_WEEK = ONE_DAY * 7;
const DEFAULT_PAGE_SIZE = 100;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.startsWith("/tag/") && pathname.endsWith("/og.png")) {
      return Response.redirect(new URL("/og.png", url).toString(), 302);
    }

    if (pathname.endsWith("/og.png")) {
      return env.ASSETS.fetch(request);
    }

    if (pathname === "/ping") {
      return new Response("Hello, world!");
    }

    const apiMatch = pathname.match(/^\/api\/([^/]+)\/([^/]+)\/?$/);

    if (apiMatch) {
      return renderApiResponse(url, apiMatch[1], apiMatch[2]);
    }

    const libraryMatch = pathname.match(/^\/library\/([^/]+)\/?$/);

    if (libraryMatch) {
      return renderLibraryResponse(libraryMatch[1]);
    }

    if (pathname.startsWith("/category/")) {
      const id = getPathSegment(pathname, "category");

      if (id) {
        return renderCategoryResponse(
          pathname,
          getCategory(id, getCatalogOptions(url)),
        );
      }
    }

    if (pathname.startsWith("/tag/")) {
      const id = getPathSegment(pathname, "tag");

      if (id) {
        return renderCategoryResponse(
          pathname,
          getTag(id, getCatalogOptions(url)),
          {
            robots: "noindex,follow",
          },
        );
      }
    }

    if (pathname === "/blog/" || pathname === "/blog") {
      return renderPageResponse("blog", {
        blogPosts: getBlogPosts(),
        pageMeta: {
          title: "JSter – Blog",
          description: "News relevant to JavaScript",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;

async function renderApiResponse(
  url: URL,
  sourceParam: string | undefined,
  idParam: string | undefined,
) {
  const source = getSource(sourceParam);
  const id = idParam ? decodeURIComponent(idParam) : "";

  if (!source || !id) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  try {
    const page = parsePositiveInteger(url.searchParams.get("page"), 1);
    const pageSize = parsePositiveInteger(
      url.searchParams.get("pageSize"),
      DEFAULT_PAGE_SIZE,
    );
    const catalogPage = await getCategoryLibraries(source, id, page, pageSize);

    return jsonResponse(catalogPage, 200);
  } catch (error) {
    console.error(error);

    return jsonResponse({ error: "Not found" }, 404);
  }
}

async function renderLibraryResponse(name: string | undefined) {
  if (!name) {
    return notFoundResponse();
  }

  try {
    const library = await fetchLibrary(decodeURIComponent(name));

    ZLibrary.parse(library);

    const stargazers = 0;

    if (stargazers) {
      library.stargazers = stargazers;
    }

    const security = await fetchSecurity(library.name);

    if (security) {
      library.security = security;
    }

    return renderPageResponse(`/library/${name}/`, {
      library,
      pageMeta: {
        title: `${library.name} – JSter`,
        description: library.description,
      },
    });
  } catch (error) {
    console.error(error);
  }

  return notFoundResponse();
}

async function renderCategoryResponse(
  pathname: string,
  categoryPromise: ReturnType<typeof getCategory> | ReturnType<typeof getTag>,
  meta: { robots?: string } = {},
) {
  try {
    const category = await categoryPromise;

    return renderPageResponse(pathname, {
      category,
      pageMeta: {
        title: `${category.title} – JSter`,
        description: `${category.title} JavaScript libraries`,
        ...meta,
      },
    });
  } catch (error) {
    if (isMissingSourceError(error)) {
      return notFoundResponse();
    }

    throw error;
  }
}

async function renderPageResponse(
  pathname: string,
  initialContext: Record<string, unknown>,
) {
  const resolvedContext = Object.fromEntries(
    await Promise.all(
      Object.entries(initialContext).map(async ([key, value]) => [
        key,
        value instanceof Promise ? await value : value,
      ]),
    ),
  );
  const { markup } = await render(pathname, resolvedContext);

  return new Response(markup, {
    headers: cacheHeaders("text/html;charset=UTF-8"),
  });
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers:
      status >= 200 && status < 300
        ? cacheHeaders("application/json;charset=UTF-8")
        : noStoreHeaders("application/json;charset=UTF-8"),
  });
}

function notFoundResponse() {
  return new Response("Not found", {
    status: 404,
    headers: noStoreHeaders("text/plain;charset=UTF-8"),
  });
}

function cacheHeaders(contentType: string) {
  return {
    "Content-Type": contentType,
    "Cache-Control": `public, max-age=${ONE_DAY}`,
    "Cloudflare-CDN-Cache-Control": `public, max-age=${ONE_DAY}, stale-while-revalidate=${ONE_WEEK}`,
  };
}

function noStoreHeaders(contentType: string) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  };
}

function getSource(source?: string): CatalogSource | undefined {
  if (source === "category" || source === "tag") {
    return source;
  }
}

function fetchLibrary(name: string): Promise<Library> {
  const url = `https://raw.githubusercontent.com/jsterlibs/website-v2/main/data/libraries/${name}.json`;

  return fetch(url).then((res) => res.json());
}

async function fetchSecurity(name: string): Promise<Library["security"]> {
  try {
    const npmName = name.trim().toLowerCase();
    const { metrics, score, error } = await fetch(
      `https://socket.dev/api/npm/package-info/score?name=${npmName}&low_priority=1`,
    ).then((res) =>
      res.json<{
        metrics: Record<string, number>;
        score: Record<string, { score: number }>;
        error: string;
      }>(),
    );

    if (error) {
      return;
    }

    return {
      npmName,
      // @ts-expect-error TODO: Type and validate this accurately
      metrics,
      score: {
        supplyChain: score.supplyChainRisk.score,
        quality: score.quality.score,
        maintenance: score.maintenance.score,
        vulnerability: score.vulnerability.score,
        license: score.license.score,
      },
    };
  } catch (error) {}
}

function getPathSegment(pathname: string, base: string) {
  const [segment] = pathname
    .replace(new RegExp(`^/${base}/?`), "")
    .replace(/\/$/, "")
    .split("/");

  return segment ? decodeURIComponent(segment) : "";
}

function getCatalogOptions(url: URL) {
  return {
    page: parsePositiveInteger(url.searchParams.get("page"), 1),
    pathname: url.pathname,
  };
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isMissingSourceError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes(": 404") ||
      error.message.startsWith("Unknown category "))
  );
}
