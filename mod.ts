import { Application } from "oak";
import { getJsonSync } from "utils";
import { generateRoutes } from "./src/generateRoutes.ts";
import type { Components } from "./types.ts";

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const components = getJsonSync<Components>("./components.json");
  const app = new Application();
  const router = generateRoutes({
    components,
    pagesPath: "./pages",
    mode: "development",
    siteMeta: { siteName: "JSter" },
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  await app.listen({ port });
}

// TODO: Make this configurable
const port = 3000;

serve(port);
