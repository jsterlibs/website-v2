import { isr } from "../edge-utils.ts";
import { type Env } from "../types.ts";
import { getBlogPosts, getCategory, getTag } from "../edge-data.ts";
import { render } from "../render.ts";

const ONE_HOUR = 60 * 60;
const ONE_DAY = ONE_HOUR * 24;

const abTest = async (context: EventContext<Env, "", {}>) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/tag/") && pathname.endsWith("/og.png")) {
    return Response.redirect(new URL("/og.png", url).toString(), 302);
  }

  if (pathname.endsWith("/og.png")) {
    return context.next();
  }

  if (url.pathname.startsWith("/library/")) {
    return isr(
      context.request,
      context.env.PAGE_CACHE,
      context.waitUntil,
      {
        "Content-Type": "text/html;charset=UTF-8",
        // Cache results at the browser for one day
        "Cache-Control": `max-age=${ONE_DAY}`,
      },
      ONE_DAY,
      context.next
    );
  }

  if (pathname.startsWith("/category/")) {
    const id = getPathSegment(pathname, "category");

    if (id) {
      return renderWithIsr(context, () =>
        renderCategoryResponse(pathname, getCategory(id))
      );
    }
  }

  if (pathname.startsWith("/tag/")) {
    const id = getPathSegment(pathname, "tag");

    if (id) {
      return renderWithIsr(context, () =>
        renderCategoryResponse(pathname, getTag(id), {
          robots: "noindex,follow",
        })
      );
    }
  }

  if (pathname === "/blog/" || pathname === "/blog") {
    return renderWithIsr(context, () =>
      renderResponse("blog", {
        blogPosts: getBlogPosts(),
        pageMeta: {
          title: "JSter – Blog",
          description: "News relevant to JavaScript",
        },
      })
    );
  }

  return context.next();
};

export const onRequest = [abTest];

async function renderCategoryResponse(
  pathname: string,
  categoryPromise: ReturnType<typeof getCategory> | ReturnType<typeof getTag>,
  meta: { robots?: string } = {},
) {
  try {
    const category = await categoryPromise;

    return renderResponse(pathname, {
      category,
      pageMeta: {
        title: `${category.title} – JSter`,
        description: `${category.title} JavaScript libraries`,
        ...meta,
      },
    });
  } catch (error) {
    if (isMissingSourceError(error)) {
      return new Response("Not found", { status: 404 });
    }

    throw error;
  }
}

function renderWithIsr(
  context: EventContext<Env, "", {}>,
  getResponse: () => Promise<Response>,
) {
  return isr(
    context.request,
    context.env.PAGE_CACHE,
    context.waitUntil,
    {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": `max-age=${ONE_DAY}`,
    },
    ONE_DAY,
    getResponse,
  );
}

async function renderResponse(
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
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": `max-age=${ONE_DAY}`,
    },
  });
}

function getPathSegment(pathname: string, base: string) {
  const [segment] = pathname
    .replace(new RegExp(`^/${base}/?`), "")
    .replace(/\/$/, "")
    .split("/");

  return segment ? decodeURIComponent(segment) : "";
}

function isMissingSourceError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes(": 404") ||
      error.message.startsWith("Unknown category "))
  );
}
