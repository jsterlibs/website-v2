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
const SITE_URL = "https://jster.net";
const OAUTH_ISSUER = SITE_URL;
const AUTH_MD_URL = `${SITE_URL}/auth.md`;
const CATALOG_SKILL_MD = [
  "# JSter Catalog Discovery",
  "",
  "Use JSter to discover JavaScript libraries by category, tag, and library slug.",
  "",
  "Useful endpoints:",
  "",
  "- `GET /api/category/{id}` returns a paginated category listing as JSON.",
  "- `GET /api/tag/{id}` returns a paginated tag listing as JSON.",
  "- `GET /library/{id}` returns the public library page.",
  "- `GET /catalog/` returns the browseable catalog.",
  "",
  "Pagination parameters: `page` and `pageSize`.",
  "",
].join("\n");
const DISCOVERY_LINKS = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/openapi.json>; rel="service-desc"; type="application/openapi+json"',
  '</.well-known/oauth-authorization-server>; rel="oauth-authorization-server"; type="application/json"',
  '</.well-known/oauth-protected-resource>; rel="oauth-protected-resource"; type="application/json"',
  '</catalog/>; rel="service-doc"; type="text/html"',
  '</auth.md>; rel="service-doc"; type="text/markdown"',
  '</.well-known/agent-skills/index.json>; rel="service-desc"; type="application/json"',
  '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
];

export default {
  async fetch(request, env): Promise<Response> {
    try {
      const response = await handleRequest(request, env);

      return finalizeResponse(request, response);
    } catch (error) {
      logWorkerError("worker_unhandled_error", request, error);

      return internalServerErrorResponse();
    }
  },
} satisfies ExportedHandler<WorkerEnv>;

async function handleRequest(request: Request, env: WorkerEnv) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const markdownAssetResponse = await maybeMarkdownAssetResponse(
    request,
    env,
    pathname,
  );

  if (markdownAssetResponse) {
    return markdownAssetResponse;
  }

  if (pathname === "/.well-known/api-catalog") {
    return apiCatalogResponse();
  }

  if (pathname === "/.well-known/openapi.json") {
    return openApiResponse();
  }

  if (
    pathname === "/.well-known/oauth-authorization-server" ||
    pathname === "/.well-known/openid-configuration"
  ) {
    return oauthAuthorizationServerResponse();
  }

  if (pathname === "/.well-known/oauth-protected-resource") {
    return oauthProtectedResourceResponse();
  }

  if (pathname === "/.well-known/jwks.json") {
    return jwksResponse();
  }

  if (pathname === "/.well-known/agent-skills/index.json") {
    return agentSkillsIndexResponse();
  }

  if (pathname === "/.well-known/agent-skills/catalog-discovery/SKILL.md") {
    return markdownTextResponse(CATALOG_SKILL_MD);
  }

  if (pathname === "/.well-known/mcp/server-card.json") {
    return mcpServerCardResponse();
  }

  if (pathname === "/auth.md") {
    return authMdResponse();
  }

  if (pathname.startsWith("/tag/") && pathname.endsWith("/og.png")) {
    const ogUrl = new URL("/og.png", url);
    ogUrl.protocol = "https:";

    return Response.redirect(ogUrl.toString(), 302);
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
}

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
    console.warn({
      event: "api_catalog_not_found",
      source,
      id,
      error: serializeError(error),
    });

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
    if (isMissingLibraryError(error)) {
      return notFoundResponse();
    }

    throw error;
  }
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

function jsonResponse(
  body: unknown,
  status: number,
  contentType = "application/json;charset=UTF-8",
) {
  return new Response(JSON.stringify(body), {
    status,
    headers:
      status >= 200 && status < 300
        ? cacheHeaders(contentType)
        : noStoreHeaders(contentType),
  });
}

function apiCatalogResponse() {
  return jsonResponse(
    {
      linkset: [
        {
          anchor: `${SITE_URL}/api/`,
          "service-desc": [
            {
              href: `${SITE_URL}/.well-known/openapi.json`,
              type: "application/openapi+json",
            },
          ],
          "service-doc": [
            {
              href: `${SITE_URL}/catalog/`,
              type: "text/html",
            },
          ],
          status: [
            {
              href: `${SITE_URL}/ping`,
              type: "text/plain",
            },
          ],
        },
      ],
    },
    200,
    "application/linkset+json;charset=UTF-8",
  );
}

function openApiResponse() {
  return jsonResponse(
    {
      openapi: "3.1.0",
      info: {
        title: "JSter Catalog API",
        version: "1.0.0",
        description:
          "Read-only API for discovering JSter catalog entries by category or tag.",
      },
      servers: [{ url: SITE_URL }],
      paths: {
        "/api/{source}/{id}": {
          get: {
            operationId: "getCatalogEntries",
            summary: "Get catalog entries by category or tag",
            parameters: [
              {
                name: "source",
                in: "path",
                required: true,
                schema: { type: "string", enum: ["category", "tag"] },
              },
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "page",
                in: "query",
                required: false,
                schema: { type: "integer", minimum: 1, default: 1 },
              },
              {
                name: "pageSize",
                in: "query",
                required: false,
                schema: {
                  type: "integer",
                  minimum: 1,
                  maximum: DEFAULT_PAGE_SIZE,
                  default: DEFAULT_PAGE_SIZE,
                },
              },
            ],
            responses: {
              "200": {
                description: "A paginated catalog page.",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        page: { type: "integer" },
                        pageSize: { type: "integer" },
                        pageCount: { type: "integer" },
                        totalLibraries: { type: "integer" },
                        libraries: {
                          type: "array",
                          items: { type: "object" },
                        },
                      },
                    },
                  },
                },
              },
              "404": {
                description: "The category or tag was not found.",
              },
            },
          },
        },
        "/ping": {
          get: {
            operationId: "getHealth",
            summary: "Health check",
            responses: {
              "200": {
                description: "The Worker is responding.",
              },
            },
          },
        },
      },
    },
    200,
    "application/openapi+json;charset=UTF-8",
  );
}

function oauthAuthorizationServerResponse() {
  return jsonResponse(
    {
      issuer: OAUTH_ISSUER,
      authorization_endpoint: `${SITE_URL}/auth.md#authorization`,
      token_endpoint: `${SITE_URL}/auth.md#tokens`,
      jwks_uri: `${SITE_URL}/.well-known/jwks.json`,
      registration_endpoint: `${SITE_URL}/auth.md#agent-registration`,
      scopes_supported: ["catalog:read"],
      response_types_supported: ["none"],
      grant_types_supported: ["none"],
      token_endpoint_auth_methods_supported: ["none"],
      service_documentation: AUTH_MD_URL,
      agent_auth: {
        skill:
          "https://isitagentready.com/.well-known/agent-skills/auth-md/SKILL.md",
        register_uri: `${SITE_URL}/auth.md#agent-registration`,
        identity_types_supported: ["anonymous"],
        anonymous: {
          credential_types_supported: ["none"],
          claim_uri: `${SITE_URL}/auth.md#anonymous-access`,
        },
      },
    },
    200,
  );
}

function oauthProtectedResourceResponse() {
  return jsonResponse(
    {
      resource: `${SITE_URL}/api/`,
      authorization_servers: [OAUTH_ISSUER],
      scopes_supported: ["catalog:read"],
      bearer_methods_supported: ["header"],
      resource_documentation: `${SITE_URL}/.well-known/api-catalog`,
    },
    200,
  );
}

function jwksResponse() {
  return jsonResponse(
    {
      keys: [],
    },
    200,
  );
}

async function agentSkillsIndexResponse() {
  return jsonResponse(
    {
      $schema:
        "https://raw.githubusercontent.com/cloudflare/agent-skills-discovery-rfc/main/schema.json",
      skills: [
        {
          name: "jster-catalog-discovery",
          type: "documentation",
          description:
            "Discover JavaScript libraries in the JSter catalog by category, tag, and library slug.",
          url: `${SITE_URL}/.well-known/agent-skills/catalog-discovery/SKILL.md`,
          sha256: await sha256Hex(CATALOG_SKILL_MD),
        },
      ],
    },
    200,
  );
}

function authMdResponse() {
  return markdownTextResponse(
    [
      "# JSter auth.md",
      "",
      "JSter exposes public, read-only catalog pages and API endpoints for agents.",
      "",
      "## Agent Registration",
      "",
      "Agent registration is not required for the public catalog API. Agents may access catalog resources anonymously.",
      "",
      "## Anonymous Access",
      "",
      "Supported identity type: anonymous.",
      "",
      "Supported credential type: none.",
      "",
      "Required scope: catalog:read.",
      "",
      "## Authorization",
      "",
      "OAuth/OIDC credentials are not issued because the catalog API does not require authentication.",
      "",
      "## Tokens",
      "",
      "Access tokens are not required for public catalog reads.",
      "",
      "Useful discovery resources:",
      "",
      "- `/.well-known/api-catalog`",
      "- `/.well-known/openapi.json`",
      "- `/.well-known/oauth-authorization-server`",
      "- `/.well-known/oauth-protected-resource`",
      "- `/catalog/`",
      "",
    ].join("\n"),
  );
}

function mcpServerCardResponse() {
  return jsonResponse(
    {
      serverInfo: {
        name: "JSter Catalog",
        version: "1.0.0",
      },
      description:
        "JSter exposes JavaScript catalog navigation tools to browser agents through WebMCP.",
      transport: {
        type: "webmcp",
        endpoint: SITE_URL,
      },
      transports: [
        {
          type: "webmcp",
          endpoint: SITE_URL,
        },
      ],
      capabilities: {
        tools: [
          {
            name: "open_jster_catalog",
            description: "Open the JSter JavaScript library catalog.",
          },
          {
            name: "open_jster_category",
            description: "Open a JSter category page by category id.",
          },
        ],
      },
    },
    200,
  );
}

function markdownTextResponse(markdown: string) {
  return new Response(markdown, {
    headers: cacheHeaders("text/markdown;charset=UTF-8"),
  });
}

function notFoundResponse() {
  return new Response("Not found", {
    status: 404,
    headers: noStoreHeaders("text/plain;charset=UTF-8"),
  });
}

function internalServerErrorResponse() {
  return new Response("Internal server error", {
    status: 500,
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

async function maybeMarkdownAssetResponse(
  request: Request,
  env: WorkerEnv,
  pathname: string,
) {
  if (!acceptsMarkdown(request) || !pathname.startsWith("/blog/")) {
    return;
  }

  const markdownUrl = new URL(request.url);
  markdownUrl.pathname = `${pathname.replace(/\/+$/, "")}/index.md`;
  const markdownResponse = await env.ASSETS.fetch(
    new Request(markdownUrl, request),
  );

  if (!markdownResponse.ok) {
    return;
  }

  const markdown = await markdownResponse.text();
  const headers = new Headers(markdownResponse.headers);

  headers.set("Content-Type", "text/markdown;charset=UTF-8");
  headers.set("Vary", appendHeaderValue(headers.get("Vary"), "Accept"));
  headers.set("X-Markdown-Tokens", String(countMarkdownTokens(markdown)));

  return new Response(markdown, {
    status: markdownResponse.status,
    statusText: markdownResponse.statusText,
    headers,
  });
}

async function finalizeResponse(request: Request, response: Response) {
  const responseWithLinks = addDiscoveryHeaders(response);

  if (acceptsMarkdown(request) && isHtmlResponse(responseWithLinks)) {
    const html = await responseWithLinks.text();
    const markdown = htmlToMarkdown(html);
    const headers = new Headers(responseWithLinks.headers);

    headers.set("Content-Type", "text/markdown;charset=UTF-8");
    headers.set("Vary", appendHeaderValue(headers.get("Vary"), "Accept"));
    headers.set("X-Markdown-Tokens", String(countMarkdownTokens(markdown)));

    return new Response(markdown, {
      status: responseWithLinks.status,
      statusText: responseWithLinks.statusText,
      headers,
    });
  }

  if (isHtmlResponse(responseWithLinks)) {
    const headers = new Headers(responseWithLinks.headers);
    headers.set("Vary", appendHeaderValue(headers.get("Vary"), "Accept"));

    return new Response(responseWithLinks.body, {
      status: responseWithLinks.status,
      statusText: responseWithLinks.statusText,
      headers,
    });
  }

  return responseWithLinks;
}

function addDiscoveryHeaders(response: Response) {
  const headers = new Headers(response.headers);
  const existingLink = headers.get("Link");

  headers.set(
    "Link",
    existingLink
      ? `${existingLink}, ${DISCOVERY_LINKS.join(", ")}`
      : DISCOVERY_LINKS.join(", "),
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function acceptsMarkdown(request: Request) {
  const accept = request.headers.get("Accept") || "";

  return request.method !== "HEAD" && /\btext\/markdown\b/.test(accept);
}

function isHtmlResponse(response: Response) {
  return /text\/html/i.test(response.headers.get("Content-Type") || "");
}

function htmlToMarkdown(html: string) {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const source = mainMatch ? mainMatch[1] : html;

  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n\n")
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n\n")
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n\n")
    .replace(
      /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_match, href, text) => `[${stripHtml(text).trim()}](${href})`,
    )
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/^\s*-\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ");
}

function appendHeaderValue(existing: string | null, value: string) {
  if (!existing) {
    return value;
  }

  const values = existing.split(",").map((entry) => entry.trim());

  return values.includes(value) ? existing : `${existing}, ${value}`;
}

function countMarkdownTokens(markdown: string) {
  return markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getSource(source?: string): CatalogSource | undefined {
  if (source === "category" || source === "tag") {
    return source;
  }
}

async function fetchLibrary(name: string): Promise<Library> {
  const url = `https://raw.githubusercontent.com/jsterlibs/website-v2/main/data/libraries/${name}.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch library ${name}: ${response.status}`);
  }

  return response.json();
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
  } catch (error) {
    console.warn({
      event: "security_lookup_failed",
      name,
      error: serializeError(error),
    });
  }
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

function isMissingLibraryError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.startsWith("Failed to fetch library ") &&
    error.message.endsWith(": 404")
  );
}

function logWorkerError(event: string, request: Request, error: unknown) {
  const url = new URL(request.url);

  console.error({
    event,
    method: request.method,
    pathname: url.pathname,
    search: url.search,
    error: serializeError(error),
  });
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
