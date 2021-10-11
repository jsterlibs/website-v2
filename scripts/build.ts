import { ensureDir } from "fs";
import { join } from "path";
import { getComponents } from "utils";
import { generateRoutes } from "../src/generateRoutes.ts";
import { getPageRenderer } from "../src/getPageRenderer.ts";
import { getStyleSheet } from "../src/getStyleSheet.ts";

function build() {
  console.log("Building to static");

  // TODO: Maybe generateRoutes should become awaitable
  const startTime = performance.now();
  window.onunload = () => {
    const endTime = performance.now();

    console.log(`Completed in ${endTime - startTime}ms`);
  };

  const components = getComponents("./components.json");
  const outputDirectory = "./build";

  ensureDir(outputDirectory).then(() => {
    const stylesheet = getStyleSheet();
    const renderPage = getPageRenderer({
      components,
      stylesheet,
      mode: "production",
      // TODO: Extract to meta.json
      siteMeta: { siteName: "JSter" },
    });
    generateRoutes({
      renderPage(route, path, context, page) {
        // TODO: Push this behind a verbose flag
        // console.log("Building", route);

        const dir = join(outputDirectory, route);

        ensureDir(dir).then(() =>
          renderPage(route, path, context, page).then((d) =>
            Deno.writeTextFile(join(dir, "index.html"), d)
          ).catch((err) => console.error(err))
        );
      },
      pagesPath: "./pages",
    });
  });
}

if (import.meta.main) {
  build();
}

export { build };
