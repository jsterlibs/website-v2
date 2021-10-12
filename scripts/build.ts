import { ensureDir } from "fs";
import { join } from "path";
import { getComponents } from "utils";
import { generateRoutes } from "../src/generateRoutes.ts";
import { getPageRenderer } from "../src/getPageRenderer.ts";
import { getStyleSheet } from "../src/getStyleSheet.ts";

function build() {
  console.log("Building to static");

  let routes: string[] = [];

  // TODO: Maybe generateRoutes should become awaitable
  const startTime = performance.now();
  window.onunload = () => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const routeAmount = routes.length;

    console.log(
      `Generated ${routeAmount} pages in ${duration}ms.\nAverage: ${Math.round(
        duration /
          routeAmount * 1000,
      ) / 1000} ms per page.`,
    );
  };

  const components = getComponents("./components.json");
  const outputDirectory = "./build";

  ensureDir(outputDirectory).then(async () => {
    const stylesheet = getStyleSheet();
    const renderPage = getPageRenderer({
      components,
      stylesheet,
      mode: "production",
    });
    const ret = await generateRoutes({
      renderPage(route, path, context, page) {
        // TODO: Push this behind a verbose flag
        // console.log("Building", route);

        const dir = join(outputDirectory, route);

        ensureDir(dir).then(() =>
          Deno.writeTextFile(
            join(dir, "index.html"),
            renderPage(route, path, context, page),
          )
        );
      },
      pagesPath: "./pages",
      // TODO: Extract to meta.json
      siteMeta: { siteName: "JSter" },
    });

    routes = ret.routes;
  });
}

if (import.meta.main) {
  build();
}

export { build };
