import { Router } from "oak";
import { dir, getJsonSync, reversed, zipToObject } from "utils";
import type { Components, SiteMeta } from "../types.ts";
import { getPageRenderer } from "./getPageRenderer.ts";
import { getStyleSheet } from "./getStyleSheet.ts";

/*
import getBlogPosts from "../dataSources/blogPosts.ts";
import getCategories from "../dataSources/categories.ts";
import getLibraries from "../dataSources/libraries.ts";
import getParentCategories from "../dataSources/parentCategories.ts";
*/

type Page = {
  meta: Record<string, string>;
  dataSources?: { name: string; matchBy: string; transformWith: string }[];
};

function generateRoutes(
  { components, pagesPath, mode, siteMeta }: {
    components: Components;
    pagesPath: string;
    mode: "development";
    siteMeta: SiteMeta;
  },
) {
  const stylesheet = getStyleSheet();
  const renderPage = getPageRenderer({
    components,
    stylesheet,
    mode,
    siteMeta,
  });

  const router = new Router();

  const pages = dir(pagesPath).map((o) => ({
    ...o,
    ...getJsonSync<Page>(o.path),
  }));

  pages.forEach(({ dataSources, name, path }) => {
    let rootPath = name.split(".").slice(0, -1).join(".");
    rootPath = rootPath === "index" ? "" : rootPath;

    if (dataSources) {
      Promise.all(
        dataSources.map(({ name, transformWith }) =>
          import(`../dataSources/${name}.ts`).then((o) => {
            let data = o.default();

            if (transformWith === "reversed") {
              data = reversed(data);
            }

            return [name, data];
          })
        ),
      ).then((
        dataSources,
      ) => {
        router.get(
          `/${rootPath}`,
          // TODO: Support matchBy and transformWith (reversed)
          // @ts-ignore Figure out the type
          renderPage(path, zipToObject(dataSources)),
        );
      });
    } else {
      router.get(`/${rootPath}`, renderPage(path));
    }
  });

  /*
  router
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
  */

  return router;
}

export { generateRoutes };
