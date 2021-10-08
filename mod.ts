import { Application, Router } from "oak";
import { getComponents, watch } from "utils";
import { generateRoutes } from "./src/generateRoutes.ts";
import { getPageRenderer } from "./src/getPageRenderer.ts";
import { getStyleSheet } from "./src/getStyleSheet.ts";

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const components = getComponents("./components.json");
  const app = new Application();
  const router = new Router();

  // Touch this file if any json file in the project changes to trigger
  // a rebuild.
  watch(
    ".",
    ".json",
    () => Deno.run({ cmd: ["touch", new URL("", import.meta.url).pathname] }),
  );

  const stylesheet = getStyleSheet();
  const renderPage = getPageRenderer({
    components,
    stylesheet,
    mode: "development",
    // TODO: Extract to meta.json
    siteMeta: { siteName: "JSter" },
  });
  await generateRoutes({
    renderPage(route, path, context, page) {
      router.get(route, async (ctx) => {
        try {
          ctx.response.headers.set(
            "Content-Type",
            "text/html; charset=UTF-8",
          );

          const data = await renderPage(
            ctx.request.url.pathname,
            path,
            context,
            page,
          );

          ctx.response.body = new TextEncoder().encode(
            data,
          );
        } catch (err) {
          console.error(err);

          ctx.response.body = new TextEncoder().encode(err.stack);
        }
      });
    },
    pagesPath: "./pages",
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  await app.listen({ port });
}

// TODO: Make this configurable
const port = 3000;

serve(port);
