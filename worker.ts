import { getBlogPosts, getCategoryLibraries, getTag } from "./edge-data.ts";
import { render } from "./render.ts";
import { ZLibrary, type Library } from "./types.ts";

type CatalogSource = "category" | "tag";

const ONE_HOUR = 60 * 60;
const ONE_DAY = ONE_HOUR * 24;
const ONE_WEEK = ONE_DAY * 7;
const DEFAULT_PAGE_SIZE = 100;
const UPSTREAM_TIMEOUT_MS = 5_000;
const LIBRARY_CACHE_NAME = "jster-library-v1";
const SECURITY_CACHE_NAME = "jster-security-v1";
const SITE_URL = "https://jster.net";
const OAUTH_ISSUER = SITE_URL;
const AUTH_MD_URL = `${SITE_URL}/auth.md`;
const LIBRARY_REDIRECTS: Record<string, string> = {
  "angular-2025-strategy": "angular",
  "angular-8": "angular",
  "angular-9": "angular",
  "astro-7-0-is-all-about-speed": "astro",
  "babylon-js": "babylonjs",
  "es6-harmony-collections": "es6-collections",
  impromptu: "jquery-impromptu",
  iioengine: "iio",
  "jets-js": "jets",
  lungojs: "lungo-js",
  "next-js-13": "next-js",
  "next-js-14": "next-js",
  "next-js-15": "next-js",
  "next-js-15-3-with-turbopack-for-builds": "next-js",
  "react-19": "react",
  "rivets-js": "rivets",
  "svelte-5-is-alive": "svelte",
};
const TAG_REDIRECTS: Record<string, string> = {
  "d3.js": "d3",
  d3js: "d3",
  autocompletion: "autocomplete",
  bakbone: "backbone",
  coffescript: "coffeescript",
  conrol: "control",
  cookie: "cookies",
  dependancy: "dependency",
  "drag-n-drop": "drag-and-drop",
  expressjs: "express",
  expression: "expressions",
  extension: "extensions",
  funcional: "functional",
  Javasript: "javascript",
  "javascript.": "javascript",
  JS: "javascript",
  jTag: "jTags",
  jqueryui: "jquery-ui",
  key: "keyboard",
  keypress: "keyboard",
  keys: "keyboard",
  keystroke: "keyboard",
  "knockout.js": "knockout",
  layoutengine: "layout",
  Maths: "math",
  nextjs: "next.js",
  notification: "notifications",
  number: "numbers",
  nodejs: "node.js",
  opensource: "open-source",
  p2p: "peer-to-peer",
  param: "parameter",
  perfomance: "performance",
  progressbar: "progress",
  "range.": "range",
  organization: "organizational",
  reactjs: "react",
  Realtime: "realtime",
  "real-time": "realtime",
  Structures: "data-structures",
  threejs: "three.js",
  transition: "transitions",
  trasitions: "transitions",
  "underscore.js": "underscore",
  paging: "pagination",
  validations: "validation",
  validator: "validation",
  Webworker: "web-workers",
  Webcomponents: "web-components",
  "widget.": "widget",
  hotkey: "keyboard",
  hotkeys: "keyboard",
  shortcuts: "keyboard",
};
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
  async fetch(request, env, ctx): Promise<Response> {
    try {
      const httpsRedirect = maybeHttpsRedirect(request);

      if (httpsRedirect) {
        return httpsRedirect;
      }

      const response = await handleRequest(request, env, ctx);

      return finalizeResponse(request, response);
    } catch (error) {
      logWorkerError("worker_unhandled_error", request, error);

      return internalServerErrorResponse();
    }
  },
} satisfies ExportedHandler<Env>;

function maybeHttpsRedirect(request: Request) {
  const visitor = request.headers.get("CF-Visitor");

  if (!visitor) {
    return;
  }

  try {
    const { scheme } = JSON.parse(visitor) as { scheme?: unknown };

    if (scheme !== "http") {
      return;
    }
  } catch {
    return;
  }

  const url = new URL(request.url);
  url.protocol = "https:";

  return Response.redirect(url.toString(), 308);
}

async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) {
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
    return renderApiResponse(url, apiMatch[1], apiMatch[2], env);
  }

  const libraryMatch = pathname.match(/^\/library\/([^/]+)\/?$/);

  if (libraryMatch) {
    const libraryId = decodeURIComponent(libraryMatch[1]);
    const redirectTarget = LIBRARY_REDIRECTS[libraryId];

    if (redirectTarget) {
      const redirectUrl = new URL(`/library/${redirectTarget}`, url);

      return Response.redirect(redirectUrl.toString(), 301);
    }

    return renderLibraryResponse(libraryId, env, ctx);
  }

  if (/^\/(?:category|tag)\/[^/]+$/.test(pathname)) {
    const redirectUrl = new URL(`${pathname}/`, url);
    redirectUrl.search = url.search;

    return Response.redirect(redirectUrl.toString(), 301);
  }

  if (pathname.startsWith("/category/")) {
    const id = getPathSegment(pathname, "category");

    if (id) {
      return env.ASSETS.fetch(request);
    }
  }

  if (pathname.startsWith("/tag/")) {
    const id = getPathSegment(pathname, "tag");

    if (id) {
      const redirectTarget = TAG_REDIRECTS[id];

      if (redirectTarget) {
        const redirectUrl = new URL(
          `/tag/${encodeURIComponent(redirectTarget)}/`,
          url,
        );

        redirectUrl.search = url.search;

        return Response.redirect(redirectUrl.toString(), 301);
      }

      return renderCategoryResponse(
        pathname,
        getTag(id, {
          ...getCatalogOptions(url),
          assets: env.ASSETS,
        }),
        {
          robots: "noindex,follow",
        },
      );
    }
  }

  if (pathname === "/blog/" || pathname === "/blog") {
    return renderPageResponse("blog", {
      blogPosts: getBlogPosts(env.ASSETS),
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
  env: Env,
) {
  const source = getSource(sourceParam);
  const id = idParam ? decodeURIComponent(idParam) : "";

  if (!source || !id) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  if (source === "tag") {
    const redirectTarget = TAG_REDIRECTS[id];

    if (redirectTarget) {
      const redirectUrl = new URL(
        `/api/tag/${encodeURIComponent(redirectTarget)}`,
        url,
      );

      redirectUrl.search = url.search;

      return Response.redirect(redirectUrl.toString(), 301);
    }
  }

  try {
    const page = parsePositiveInteger(url.searchParams.get("page"), 1);
    const pageSize = parsePositiveInteger(
      url.searchParams.get("pageSize"),
      DEFAULT_PAGE_SIZE,
    );
    const catalogPage = await getCategoryLibraries(
      source,
      id,
      page,
      pageSize,
      env.ASSETS,
    );

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

async function renderLibraryResponse(
  name: string | undefined,
  env: Env,
  ctx: ExecutionContext,
) {
  if (!name) {
    return notFoundResponse();
  }

  try {
    const library = await fetchLibrary(decodeURIComponent(name), env, ctx);

    ZLibrary.parse(library);

    const stargazers = 0;

    if (stargazers) {
      library.stargazers = stargazers;
    }

    const security = await fetchSecurity(library.name, ctx);

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
  categoryPromise: ReturnType<typeof getTag>,
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
  env: Env,
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

async function fetchLibrary(
  name: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<Library> {
  const cacheRequest = new Request(
    new URL(
      `/data/libraries/${encodeURIComponent(name)}.json`,
      SITE_URL,
    ).toString(),
  );
  const cachedResponse = await getCachedResponse(
    LIBRARY_CACHE_NAME,
    cacheRequest,
    "library_cache_read_failed",
    name,
  );

  if (cachedResponse) {
    return cachedResponse.json();
  }

  const assetResponse = await env.ASSETS.fetch(cacheRequest);

  if (assetResponse.ok) {
    cacheLibraryResponse(cacheRequest, assetResponse.clone(), name, ctx);

    return assetResponse.json();
  }

  const url = `https://raw.githubusercontent.com/jsterlibs/website-v2/main/data/libraries/${name}.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch library ${name}: ${response.status}`);
  }

  const library = await response.clone().json<Library>();

  cacheLibraryResponse(cacheRequest, response, name, ctx);

  return library;
}

async function getCachedResponse(
  cacheName: string,
  request: Request,
  event: string,
  name: string,
): Promise<Response | undefined> {
  try {
    const cache = await caches.open(cacheName);
    const response = await cache.match(request);

    if (response?.ok) {
      return response;
    }
  } catch (error) {
    console.warn({
      event,
      name,
      error: serializeError(error),
    });
  }
}

function cacheLibraryResponse(
  request: Request,
  response: Response,
  name: string,
  ctx: ExecutionContext,
) {
  const cacheableResponse = new Response(response.body, {
    status: response.status,
    headers: cacheHeaders("application/json;charset=UTF-8"),
  });

  ctx.waitUntil(
    cacheResponse(
      LIBRARY_CACHE_NAME,
      request,
      cacheableResponse,
      "library_cache_write_failed",
      name,
    ),
  );
}

async function fetchSecurity(
  name: string,
  ctx: ExecutionContext,
): Promise<Library["security"]> {
  try {
    const npmName = name.trim().toLowerCase();
    const cacheRequest = new Request(
      new URL(
        `/__cache/security/${encodeURIComponent(npmName)}.json`,
        SITE_URL,
      ).toString(),
    );
    const cachedResponse = await getCachedResponse(
      SECURITY_CACHE_NAME,
      cacheRequest,
      "security_cache_read_failed",
      name,
    );

    if (cachedResponse) {
      return cachedResponse.json<NonNullable<Library["security"]>>();
    }

    const response = await fetch(
      `https://socket.dev/api/npm/package-info/score?name=${encodeURIComponent(npmName)}&low_priority=1`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok || !contentType.toLowerCase().includes("application/json")) {
      console.warn({
        event: "security_lookup_upstream_error",
        name,
        status: response.status,
        contentType,
        cfMitigated: response.headers.get("cf-mitigated"),
      });

      return;
    }

    const { metrics, score, error } = await response.json<{
      metrics: Record<string, number>;
      score: Record<string, { score: number }>;
      error: string;
    }>();

    if (error) {
      return;
    }

    const security: NonNullable<Library["security"]> = {
      metrics: {
        dependencyCount: metrics.dependencyCount,
        dependencyVulnerabilityCount: metrics.dependencyVulnerabilityCount,
      },
      score: {
        supplyChain: score.supplyChainRisk.score,
        quality: score.quality.score,
        maintenance: score.maintenance.score,
        vulnerability: score.vulnerability.score,
        license: score.license.score,
      },
    };

    ctx.waitUntil(
      cacheResponse(
        SECURITY_CACHE_NAME,
        cacheRequest,
        new Response(JSON.stringify(security), {
          headers: cacheHeaders("application/json;charset=UTF-8"),
        }),
        "security_cache_write_failed",
        name,
      ),
    );

    return security;
  } catch (error) {
    console.warn({
      event: "security_lookup_failed",
      name,
      error: serializeError(error),
    });
  }
}

async function cacheResponse(
  cacheName: string,
  request: Request,
  response: Response,
  event: string,
  name: string,
) {
  try {
    const cache = await caches.open(cacheName);

    await cache.put(request, response);
  } catch (error) {
    console.warn({
      event,
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
