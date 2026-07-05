import { getCategoryLibraries } from "../../../edge-data.ts";
import type { Env } from "../../../types.ts";

const ONE_DAY = 60 * 60 * 24;
const DEFAULT_PAGE_SIZE = 100;

type CatalogSource = "category" | "tag";

export async function onRequest(
  context: EventContext<Env, "source" | "id", { source?: string; id?: string }>,
): Promise<Response> {
  const source = getSource(context.params.source);
  const id = getParam(context.params.id);

  if (!source || !id) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  try {
    const url = new URL(context.request.url);
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

function getSource(source?: string | string[]): CatalogSource | undefined {
  if (Array.isArray(source)) {
    return;
  }

  if (source === "category" || source === "tag") {
    return source;
  }
}

function getParam(param?: string | string[]) {
  return Array.isArray(param) ? param[0] : param;
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Cache-Control": `max-age=${ONE_DAY}`,
    },
  });
}
