import { getStyleTag } from "twind-sheets";
import { get, getJson } from "utils";
import { renderComponent } from "./renderComponent.ts";
import type {
  Component,
  Components,
  DataContext,
  Page,
  SiteMeta,
} from "../types.ts";
import { getStyleSheet } from "./getStyleSheet.ts";
import { websocketClient } from "./webSockets.ts";

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
  return (
    pathname: string,
    pagePath: string,
    pageData: DataContext,
    page: Page,
  ) =>
    getJson<{ meta: Meta; page: Component }>(pagePath).then(
      ({ meta, page: pageComponent }) => {
        const body = renderComponent(
          {
            children: Array.isArray(pageComponent)
              ? pageComponent
              : [pageComponent],
          },
          components,
          { ...pageData, pathname },
        );
        const styleTag = getStyleTag(stylesheet);

        return htmlTemplate({
          meta: {
            ...applyData(meta, { ...pageData, pathname, pagePath }),
            pathname,
            pagePath,
            "og:site_name": siteMeta.siteName || "",
            "twitter:site": siteMeta.siteName || "",
            "og:title": meta.title || "",
            "twitter:title": meta.title || "",
            "og:description": meta.description || "",
            "twitter:description": meta.description || "",
          },
          head: styleTag,
          body,
          mode,
          page,
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

function htmlTemplate({ meta, head, body, mode, page }: {
  meta: Meta;
  head?: string;
  body?: string;
  mode: Mode;
  page: Page;
}) {
  const title = meta.title || "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8"
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <script type="text/javascript" src="https://unpkg.com/sidewind@3.3.3/dist/sidewind.umd.production.min.js"></script>
    ${
    mode === "development"
      ? `<script type="module" src="https://cdn.skypack.dev/twind/shim"></script>
<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/josdejong/jsoneditor/dist/jsoneditor.min.css">
<script src="https://cdn.jsdelivr.net/gh/josdejong/jsoneditor/dist/jsoneditor.min.js"></script>`
      : ""
  }
    ${generateMeta(meta)}
    ${head || ""}
  </head>
  <body>
    ${
    mode === "development"
      ? `<div x-state="{ showEditor: false }">
      <button type="button" class="fixed bottom-0 right-0 m-2" onclick="setState(({ showEditor }) => ({ showEditor: !showEditor }))">
        <div x-class="state.showEditor && 'hidden'">Show editor</div>
        <div x-class="!state.showEditor && 'hidden'">Hide editor</div>
      </button>
      <div x-class="!state.showEditor && 'hidden'">
        <div id="jsoneditor" class="w-full h-1/2"></div>
      </div>
      <script>
      ${websocketClient}
      const container = document.getElementById("jsoneditor");
      const editor = new JSONEditor(container, {
        onChangeJSON(data) {
          socket.send(JSON.stringify({
            type: 'update',
            payload: {
              path: "${meta.pagePath}",
              data
            }
          }));
        }
      });

      editor.set(${JSON.stringify(page, null, 2)});
      </script>
      <div id="pagebody">${body || ""}</div>
    </div>`
      : body || ""
  }
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
