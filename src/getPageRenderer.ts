import { getStyleTag } from "twind-sheets";
import { get, getJson } from "utils";
import { renderComponent } from "./renderComponent.ts";
import type { Component, Components, DataContext, SiteMeta } from "../types.ts";
import { getStyleSheet } from "./getStyleSheet.ts";

type Mode = "development" | "production";
type Meta = Record<string, string>;

function getPageRenderer(
  { components, stylesheet, mode, siteMeta }: {
    components: Components;
    stylesheet: ReturnType<typeof getStyleSheet>;
    mode: Mode;
    siteMeta: SiteMeta;
  },
) {
  return (pathname: string, pagePath: string, pageData?: DataContext) =>
    getJson<{ meta: Meta; page: Component }>(pagePath).then(
      ({ meta, page }) => {
        const body = renderComponent(
          {
            children: Array.isArray(page) ? page : [page],
          },
          components,
          { ...pageData, pathname },
        );
        const styleTag = getStyleTag(stylesheet);

        return htmlTemplate({
          siteMeta,
          meta: applyData(meta, { ...pageData, pathname }),
          head: styleTag,
          body,
          mode,
        });
      },
    );
}

function applyData(meta: Meta, dataContext?: DataContext) {
  const ret: Meta = {};

  Object.entries(meta).forEach(([k, v]) => {
    if (k.startsWith("__") && dataContext) {
      ret[k.slice(2)] = get<DataContext>(dataContext, v);
    } else {
      ret[k] = v;
    }
  });

  return ret;
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
    ${
    mode === "development"
      ? `<script type="text/javascript" src="https://livejs.com/live.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/vanillawc/wc-codemirror@1/index.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/vanillawc/wc-codemirror@1/mode/javascript/javascript.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/vanillawc/wc-codemirror@1/theme/monokai.css">`
      : ""
  }
    ${generateMeta(meta)}
    ${head || ""}
  </head>
  <body>
    <wc-codemirror mode="javascript" theme="monokai">
      <script type="wc-content">
      function myGoodPerson(){
        return "what can I do for you ?"
      }
      </script>
    </wc-codemirror>
    ${body || ""}
  </body>
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

export { getPageRenderer };
