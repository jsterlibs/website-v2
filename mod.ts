import { Application } from "oak";
import { setup } from "twind";
import { getStyleTag, virtualSheet } from "twind-sheets";
import * as colors from "twind-colors";
import { getJsonSync } from "utils";
import { renderComponent } from "./src/renderComponent.ts";
import type { Component, Components } from "./types.ts";

type Meta = Record<string, string>;

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const siteTitle = "JSter – JavaScript Catalog";
  const document: Component = getJsonSync("./site.json");
  const components: Components = getJsonSync("./components.json");
  const stylesheet = getStyleSheet();
  const app = new Application();

  app.use((context) => {
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

      context.response.headers.set("Content-Type", "text/html; charset=UTF-8");
      context.response.body = new TextEncoder().encode(
        htmlTemplate({ title: siteTitle, head: styleTag, body }),
      );
    } catch (err) {
      console.error(err);

      context.response.body = new TextEncoder().encode(err.stack);
    }
  });

  await app.listen({ port });
}

// TODO: Extract script + link bits (too specific)
function htmlTemplate(
  { title, meta, head, body }: {
    title: string;
    meta?: Meta;
    head?: string;
    body?: string;
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
    <script type="text/javascript" src="https://livejs.com/live.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/tailwindcss@2.0.1/dist/base.min.css" />
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
