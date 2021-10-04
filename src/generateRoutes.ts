import { Router } from "oak";
import { dir, getJsonSync, reversed, zipToObject } from "utils";
import type { Components, SiteMeta } from "../types.ts";
import { getPageRenderer } from "./getPageRenderer.ts";
import { getStyleSheet } from "./getStyleSheet.ts";

type Page = {
  meta: Record<string, string>;
  matchBy?: { dataSource: string; field: string };
  dataSources?: { name: string; transformWith: string }[];
};

// TODO: Convert router as an adapter to break the coupling
function generateRoutes(
  { components, pagesPath, mode, siteMeta }: {
    components: Components;
    pagesPath: string;
    mode: "development" | "production";
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

  pages.forEach(({ dataSources, matchBy, name, path }) => {
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
        const pageData = zipToObject<{ dataSource: { id: string } }>(
          // @ts-ignore Figure out the type
          dataSources,
        );

        if (rootPath.startsWith("[") && rootPath.endsWith("]")) {
          const routerPath = rootPath.slice(1, -1);

          if (matchBy) {
            const dataSource = pageData[matchBy.dataSource];

            Object.values(dataSource).forEach((v) => {
              router.get(
                `/${routerPath}/${v.id}`,
                renderPage(path, { ...pageData, match: v }),
              );
            });
          } else {
            console.warn(`Path ${rootPath} is missing a matchBy`);
          }
        } else {
          router.get(`/${rootPath}`, renderPage(path, pageData));
        }
      });
    } else {
      router.get(`/${rootPath}`, renderPage(path));
    }
  });

  return router;
}

export { generateRoutes };
