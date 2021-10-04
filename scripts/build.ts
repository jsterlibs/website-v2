import { ensureDirSync } from "fs";
import { join } from "path";
import { getComponents } from "utils";
import { generateRoutes } from "../src/generateRoutes.ts";
import { getPageRenderer } from "../src/getPageRenderer.ts";
import { getStyleSheet } from "../src/getStyleSheet.ts";

function build() {
  console.log("Building to static");

  const components = getComponents("./components.json");
  const outputDirectory = "./build";

  ensureDirSync(outputDirectory);

  const stylesheet = getStyleSheet();
  const renderPage = getPageRenderer({
    components,
    stylesheet,
    mode: "production",
    // TODO: Extract to meta.json
    siteMeta: { siteName: "JSter" },
  });
  generateRoutes({
    renderPage(route, path, context) {
      // TODO: Render to filesystem
      console.log("Building", route);

      Deno.writeTextFileSync(
        join(outputDirectory, route),
        renderPage(path, context),
      );
    },
    pagesPath: "./pages",
  });
}

if (import.meta.main) {
  build();
}

export { build };
