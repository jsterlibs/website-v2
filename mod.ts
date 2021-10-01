import { Application, Router } from "oak";
import { getJsonSync, reversed } from "utils";
import type { Components, Library } from "./types.ts";
import { getPageRenderer } from "./src/getPageRenderer.ts";
import { getStyleSheet } from "./src/getStyleSheet.ts";
import getBlogPosts from "./dataSources/blogPosts.ts";
import getCategories from "./dataSources/categories.ts";
import getLibraries from "./dataSources/libraries.ts";
import getParentCategories from "./dataSources/parentCategories.ts";

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const components = getJsonSync<Components>("./components.json");

  // Data
  const blogPosts = getBlogPosts();
  const parentCategories = getParentCategories();
  const categories = getCategories();
  const libraries = getLibraries();

  // Meta
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
    // TODO: Support specific blog pages
    .get(
      "/blog",
      renderPage("./pages/blog.json", {
        blogPosts: reversed(Object.values(blogPosts)),
      }),
    )
    .get("/catalog", renderPage("./pages/catalog.json"))
    .get("/about", renderPage("./pages/about.json"))
    .get("/add-library", renderPage("./pages/add-library.json"))
    .get("/blog/:id", (context) => {
      const id = context.params.id;

      if (!id) {
        return;
      }

      const post = blogPosts.find((blogPost) => blogPost.id === id);

      if (!post) {
        return;
      }

      renderPage("./pages/[blog].json", { post })(context);
    })
    .get("/category/:id", (context) => {
      const id = context.params.id;

      if (!id) {
        return;
      }

      const category = categories.find((category) => category.id === id);

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

      const library = libraries.find((library) => library.id === id);

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

// TODO: Make this configurable
const port = 3000;

serve(port);
