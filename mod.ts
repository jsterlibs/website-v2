import { Application, Router } from "oak";
import type { RouteParams, RouterContext } from "oak";
import { setup } from "twind";
import { getStyleTag, virtualSheet } from "twind-sheets";
import * as colors from "twind-colors";
import typography from "twind-typography";
import { dir, get, getJsonSync, zipToObject } from "utils";
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

  const parentCategories = getJsonSync<ParentCategory[]>(
    "./data/parent-categories.json",
  );
  const categories = getCategories(
    "./data/categories.json",
  );
  const components = getJsonSync<Components>("./components.json");
  const libraries = getLibraries(
    "./data/libraries",
  );
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

  // TODO: Generate routes based on the pages directory
  const router = new Router();
  router
    .get("/", renderPage("./pages/index.json"))
    .get("/blog", renderPage("./pages/blog.json"))
    .get("/catalog", renderPage("./pages/catalog.json"))
    .get("/about", renderPage("./pages/about.json"))
    .get("/add-library", renderPage("./pages/add-library.json"))
    .get("/category/:id", (context) => {
      const id = context.params.id;

      if (!id) {
        return;
      }

      const category = categories[id];

      if (!category) {
        return;
      }

      const libraries = getJsonSync<Library[]>(`data/categories/${id}.json`);

      renderPage("./pages/[category].json", { category, libraries })(context);
    })
    .get("/library/:id", (context) => {
      const id = context.params.id;

      if (!id) {
        return;
      }

      const library = libraries[id];

      if (!library) {
        return;
      }

      renderPage("./pages/[library].json", { library })(context);
    });

  const app = new Application();

  app.use(router.routes());
  app.use(router.allowedMethods());

  await app.listen({ port });
}

function getCategories(p: string) {
  return zipToObject<Category>(
    getJsonSync<Category[]>(p).map((o: Category) => [o.id, o]),
  );
}

function getLibraries(
  p: string,
) {
  return zipToObject<Library>(
    dir(p).map((
      { name, path },
    ) => [name.split(".")[0], getJsonSync<Library>(path)]),
  );
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
      const { meta, page } = getJsonSync<{ meta: Meta; page: Component }>(
        pagePath,
      );

      try {
        const body = renderComponent(
          {
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

// https://twind.dev/handbook/the-shim.html#server
function getStyleSheet() {
  const sheet = virtualSheet();

  setup({ sheet, theme: { colors }, plugins: { ...typography() } });

  return sheet;
}

// TODO: Make this configurable
const port = 3000;

serve(port);
