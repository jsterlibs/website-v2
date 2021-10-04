import { getComponents } from "utils";
import { generateRoutes } from "../src/generateRoutes.ts";

// TODO: Build site to static
function build() {
  console.log("Building to static");

  const components = getComponents("./components.json");

  // TODO: Decouple router from this
  /*
  generateRoutes({
    components,
    pagesPath: "./pages",
    mode: "production",
    siteMeta: { siteName: "JSter" },
  });
  */
}

if (import.meta.main) {
  build();
}

export { build };
