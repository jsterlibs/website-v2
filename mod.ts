import { Application, Router } from "oak";
import type { RouteParams, RouterContext } from "oak";
import { setup } from "twind";
import { getStyleTag, virtualSheet } from "twind-sheets";
import * as colors from "twind-colors";
import { getJsonSync } from "utils";
import { renderComponent } from "./src/renderComponent.ts";
import type { Component, Components } from "./types.ts";

type Mode = "development" | "production";
type Meta = Record<string, string>;

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const components: Components = getJsonSync("./components.json");
  const stylesheet = getStyleSheet();

  const router = new Router();
  router
    .get(
      "/",
      renderPage({
        pagePath: "./pages/index.json",
        components,
        stylesheet,
        title: "JSter - JavaScript Catalog",
        mode: "development",
      }),
    )
    .get("/blog", (context) => {
      context.response.body = "blog goes here";
    })
    .get("./catalog", (context) => {
      context.response.body = "catalog goes here";
    })
    .get("./about", (context) => {
      context.response.body = "about goes here";
    })
    .get("./add-library", (context) => {
      context.response.body = "add library goes here";
    })
    .get("./category/:id", (context) => {
      if (context.params && context.params.id) {
        context.response.body = context.params.id;
      }
    })
    .get("./library/:id", (context) => {
      if (context.params && context.params.id) {
        context.response.body = context.params.id;
      }
    });

  const app = new Application();
  app.use(router.routes());
  app.use(router.allowedMethods());

  await app.listen({ port });
}

function renderPage(
  { pagePath, components, stylesheet, title, mode }: {
    pagePath: string;
    components: Components;
    stylesheet: ReturnType<typeof getStyleSheet>;
    title: string;
    mode: Mode;
  },
) {
  return (context: RouterContext<RouteParams, Record<string, unknown>>) => {
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

// TODO: Extract script + link bits (too specific)
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

  setup({ sheet, theme: { colors } });

  return sheet;
}

// TODO: Make this configurable
const port = 3000;

serve(port);
