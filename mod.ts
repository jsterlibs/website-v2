import { Application, Router } from "oak";
import type { RouteParams, RouterContext } from "oak";
import { setup } from "twind";
import { getStyleTag, virtualSheet } from "twind-sheets";
import * as colors from "twind-colors";
import typography from "twind-typography";
import { getJsonSync } from "utils";
import { renderComponent } from "./src/renderComponent.ts";
import type { Category, Component, Components, Library } from "./types.ts";

type Mode = "development" | "production";
type Meta = Record<string, string>;
type SiteMeta = { siteName: string };

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const categories: Category[] = getJsonSync("./data/categories.json");
  const components: Components = getJsonSync("./components.json");
  const stylesheet = getStyleSheet();
  const mode = "development";
  const siteMeta = { siteName: "Jster" };
  const renderPage = getPageRenderer({
    components,
    stylesheet,
    mode,
    siteMeta,
  });

  const router = new Router();
  router
    .get("/", renderPage("./pages/index.json"))
    .get("/blog", renderPage("./pages/blog.json"))
    .get("/catalog", renderPage("./pages/catalog.json"))
    .get("/about", renderPage("./pages/about.json"))
    .get("/add-library", renderPage("./pages/add-library.json"))
    // TODO
    .get("/category/:id", (context) => {
      const id = context.params.id;

      if (id) {
        const category = categories.find((c) => c.id === id);
        // TODO: Get category too
        const libraries: Library[] = getJsonSync(`data/categories/${id}.json`);

        console.log("category", category, "libraries", libraries);

        // TODO: Add lookup + context
        renderPage("./pages/[category].json")(context);
      }
    })
    // TODO
    .get("/library/:id", (context) => {
      const id = context.params.id;

      if (id) {
        // TODO: Add lookup + context
        renderPage("./pages/[library].json")(context);
      }
    });

  const app = new Application();
  app.use(router.routes());
  app.use(router.allowedMethods());

  await app.listen({ port });
}

function getPageRenderer(
  { components, stylesheet, mode, siteMeta }: {
    components: Components;
    stylesheet: ReturnType<typeof getStyleSheet>;
    mode: Mode;
    siteMeta: SiteMeta;
  },
) {
  return (pagePath: string) =>
    (context: RouterContext<RouteParams, Record<string, unknown>>) => {
      const { meta, page }: { meta: Meta; page: Component } = getJsonSync(
        pagePath,
      );

      try {
        const body = renderComponent(
          {
            element: "main", // TODO: Not correct
            children: Array.isArray(page) ? page : [page],
          },
          components,
          [],
        );
        const styleTag = getStyleTag(stylesheet);

        context.response.headers.set(
          "Content-Type",
          "text/html; charset=UTF-8",
        );
        context.response.body = new TextEncoder().encode(
          htmlTemplate({
            siteMeta,
            meta: meta || {},
            head: styleTag,
            body,
            mode,
          }),
        );
      } catch (err) {
        console.error(err);

        context.response.body = new TextEncoder().encode(err.stack);
      }
    };
}

function htmlTemplate({ siteMeta, meta, head, body, mode }: {
  siteMeta: SiteMeta;
  meta: Meta;
  head?: string;
  body?: string;
  mode: Mode;
}) {
  const siteName = siteMeta.siteName || "";
  const title = meta.title || "";
  const description = meta.description || "";
  const keywords = meta.keywords || "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8"
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${keywords}" />
    <meta property="og:site_name" content="${siteName}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:site" content="${siteName}" />
    <title>${title}</title>
    <script type="text/javascript" src="https://unpkg.com/sidewind@3.3.3/dist/sidewind.umd.production.min.js"></script>
    ${mode === "development" &&
    '<script type="text/javascript" src="https://livejs.com/live.js"></script>'}
    ${generateMeta(meta)}
    ${head || ""}
  </head>
  <body>${body || ""}</body>
</html>`;
}

function generateMeta(meta?: Meta) {
  if (!meta) {
    return "";
  }

  return Object.entries(meta).map(([key, value]) =>
    `<meta name="${key}" content="${value}"></meta>`
  ).join("\n");
}

// https://twind.dev/handbook/the-shim.html#server
function getStyleSheet() {
  const sheet = virtualSheet();

  setup({ sheet, theme: { colors }, plugins: { ...typography() } });

  return sheet;
}

// TODO: Make this configurable
const port = 3000;

serve(port);
