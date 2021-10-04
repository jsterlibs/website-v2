import { Application, Router } from "oak";
import { getComponents } from "utils";
import { generateRoutes } from "./src/generateRoutes.ts";
import { getPageRenderer } from "./src/getPageRenderer.ts";
import { getStyleSheet } from "./src/getStyleSheet.ts";

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const components = getComponents("./components.json");
  const app = new Application();
  const router = new Router();

  const stylesheet = getStyleSheet();
  const renderPage = getPageRenderer({
    components,
    stylesheet,
    mode: "development",
    siteMeta: { siteName: "JSter" },
  });
  generateRoutes({
    renderPage(route, path, context) {
      router.get(route, renderPage(path, context));
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
