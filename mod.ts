import { Application, Router } from "oak";
import type { RouteParams, RouterContext } from "oak";
import { setup } from "twind";
import { getStyleTag, virtualSheet } from "twind-sheets";
import * as colors from "twind-colors";
import typography from "twind-typography";
import { getJsonSync, isObject } from "utils";
import { renderComponent } from "./src/renderComponent.ts";
import type {
  Category,
  Component,
  Components,
  DataContext,
  Library,
  ParentCategory,
} from "./types.ts";

type Mode = "development" | "production";
type Meta = Record<string, string>;
type SiteMeta = { siteName: string };

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const parentCategories: ParentCategory[] = getJsonSync(
    "./data/parent-categories.json",
  );
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
    sharedData: { parentCategories },
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
        const libraries: Library[] = getJsonSync(`data/categories/${id}.json`);

        renderPage("./pages/[category].json", { category, libraries })(context);
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
          { ...sharedData, ...pageData },
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
      ret[k.slice(2)] = get(dataContext, v);
    } else {
      ret[k] = v;
    }
  });

  return ret;
}

function get(dataContext: DataContext, key: string): string {
  let value = dataContext;

  // TODO: What if the lookup fails?
  key.split(".").forEach((k) => {
    if (isObject(value)) {
      // TODO: How to type
      // @ts-ignore Recursive until it finds the root
      value = value[k];
    }
  });

  // TODO: How to type
  return value as unknown as string;
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
