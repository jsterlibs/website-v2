import type { RouteParams, RouterContext } from "oak";
import { getStyleTag } from "twind-sheets";
import { get, getJsonSync } from "utils";
import { renderComponent } from "./renderComponent.ts";
import type { Component, Components, DataContext, SiteMeta } from "../types.ts";
import { getStyleSheet } from "./getStyleSheet.ts";

type Mode = "development" | "production";
type Meta = Record<string, string>;

function getPageRenderer(
  { components, stylesheet, mode, siteMeta, sharedData }: {
    components: Components;
    stylesheet: ReturnType<typeof getStyleSheet>;
    mode: Mode;
    siteMeta: SiteMeta;
    sharedData: DataContext;
  },
) {
  return (pagePath: string, pageData?: DataContext) =>
    (
      oakContext: RouterContext<RouteParams, Record<string, unknown>>,
    ) => {
      const { meta, page } = getJsonSync<{ meta: Meta; page: Component }>(
        pagePath,
      );
      const pathname = oakContext.request.url.pathname;

      try {
        const body = renderComponent(
          {
            children: Array.isArray(page) ? page : [page],
          },
          components,
          { ...sharedData, ...pageData, pathname },
        );
        const styleTag = getStyleTag(stylesheet);

        oakContext.response.headers.set(
          "Content-Type",
          "text/html; charset=UTF-8",
        );
        oakContext.response.body = new TextEncoder().encode(
          htmlTemplate({
            siteMeta,
            meta: applyData(meta, { ...sharedData, ...pageData }),
            head: styleTag,
            body,
            mode,
          }),
        );
      } catch (err) {
        console.error(err);

        oakContext.response.body = new TextEncoder().encode(err.stack);
      }
    };
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

export { getPageRenderer };
