import { Router } from "oak";
import { reversed } from "utils";
import type { Components, SiteMeta } from "../types.ts";
import { getPageRenderer } from "./getPageRenderer.ts";
import { getStyleSheet } from "./getStyleSheet.ts";
import getBlogPosts from "../dataSources/blogPosts.ts";
import getCategories from "../dataSources/categories.ts";
import getLibraries from "../dataSources/libraries.ts";
import getParentCategories from "../dataSources/parentCategories.ts";

function generateRoutes(
  { components, pagesPath, mode, siteMeta }: {
    components: Components;
    pagesPath: string;
    mode: "development";
    siteMeta: SiteMeta;
  },
) {
  // TODO: Read pages + related data sources + construct routes
  // Data
  const blogPosts = getBlogPosts();
  const parentCategories = getParentCategories();
  const categories = getCategories();
  const libraries = getLibraries();

  const stylesheet = getStyleSheet();
  const renderPage = getPageRenderer({
    components,
    stylesheet,
    mode,
    siteMeta,
  });

  const router = new Router();

  router
    .get("/", renderPage("./pages/index.json", { parentCategories }))
    .get(
      "/blog",
      renderPage("./pages/blog.json", {
        blogPosts: reversed(Object.values(blogPosts)),
      }),
    )
    .get("/catalog", renderPage("./pages/catalog.json", { parentCategories }))
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

      renderPage("./pages/[category].json", { category })(context);
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

  return router;
}

export { generateRoutes };
