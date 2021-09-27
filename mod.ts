import { Application, Router } from "oak";
import type { RouteParams, RouterContext } from "oak";
import { setup } from "twind";
import { getStyleTag, virtualSheet } from "twind-sheets";
import * as colors from "twind-colors";
import typography from "twind-typography";
import { getJsonSync } from "utils";
import { renderComponent } from "./src/renderComponent.ts";
import type { Component, Components } from "./types.ts";

type Mode = "development" | "production";
type Meta = Record<string, string>;

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const components: Components = getJsonSync("./components.json");
  const stylesheet = getStyleSheet();
  const mode = "development";
  const renderPage = getPageRenderer({ components, stylesheet, mode });
  const getTitle = (title: string) => `JSter – ${title}`;

  const router = new Router();
  router
    .get(
      "/",
      renderPage({
        pagePath: "./pages/index.json",
        title: getTitle("JavaScript Catalog"),
      }),
    )
    .get(
      "/blog",
      renderPage({
        pagePath: "./pages/blog.json",
        title: getTitle("Blog"),
      }),
    )
    .get(
      "/catalog",
      renderPage({
        pagePath: "./pages/catalog.json",
        title: getTitle("Catalog"),
      }),
    )
    .get(
      "/about",
      renderPage({
        pagePath: "./pages/about.json",
        title: getTitle("About"),
      }),
    )
    .get(
      "/add-library",
      renderPage({
        pagePath: "./pages/add-library.json",
        title: getTitle("Add library"),
      }),
    )
    // TODO
    .get("/category/:id", (context) => {
      if (context.params && context.params.id) {
        context.response.body = context.params.id;
      }
    })
    // TODO
    .get("/library/:id", (context) => {
      if (context.params && context.params.id) {
        context.response.body = context.params.id;
      }
    });

  const app = new Application();
  app.use(router.routes());
  app.use(router.allowedMethods());

  await app.listen({ port });
}

function getPageRenderer(
  { components, stylesheet, mode }: {
    components: Components;
    stylesheet: ReturnType<typeof getStyleSheet>;
    mode: Mode;
  },
) {
  return ({ title, pagePath }: {
    title: string;
    pagePath: string;
  }) =>
    (context: RouterContext<RouteParams, Record<string, unknown>>) => {
      const document: Component = getJsonSync(pagePath);

      try {
        const body = renderComponent(
          {
            element: "main",
            children: Array.isArray(document) ? document : [document],
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
          htmlTemplate({ title, head: styleTag, body, mode }),
        );
      } catch (err) {
        console.error(err);

        context.response.body = new TextEncoder().encode(err.stack);
      }
    };
}

function htmlTemplate(
  { title, meta, head, body, mode }: {
    title: string;
    meta?: Meta;
    head?: string;
    body?: string;
    mode: Mode;
  },
) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8"
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="TODO" />
    <meta name="keywords" content="TODO" />
    <meta property="og:site_name" content="TODO" />
    <meta property="og:title" content="TODO" />
    <meta property="og:description" content="TODO" />
    <meta property="twitter:title" content="TODO" />
    <meta property="twitter:description" content="TODO" />
    <meta property="twitter:site" content="TODO" />
    <title>${title || ""}</title>
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
