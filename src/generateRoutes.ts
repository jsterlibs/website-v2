import { dir, getJsonSync, reversed, zipToObject } from "utils";
import type { Page } from "../types.ts";

async function generateRoutes(
  { renderPage, pagesPath }: {
    renderPage: (
      route: string,
      path: string,
      data: Record<string, unknown>,
      page: Page,
    ) => void;
    pagesPath: string;
  },
) {
  const pages = (await dir(pagesPath)).map((meta) => ({
    meta,
    page: getJsonSync<Page>(meta.path),
  }));
  const ret: Record<string, { context: Record<string, unknown>; page: Page }> =
    {};

  await Promise.all(pages.map(async ({ page, meta: { name, path } }) => {
    const { dataSources, matchBy } = page;
    let rootPath = name.split(".").slice(0, -1).join(".");
    rootPath = rootPath === "index" ? "" : rootPath;

    if (dataSources) {
      await Promise.all(
        dataSources.map(({ name, transformWith }) =>
          import(`../dataSources/${name}.ts`).then(async (o) => {
            let data = await o.default();

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
              const route = `/${routerPath}/${v.id}`;
              const context = { ...pageData, match: v };

              renderPage(
                route,
                path,
                context,
                page,
              );

              ret[path] = { context, page };
            });
          } else {
            console.warn(`Path ${rootPath} is missing a matchBy`);
          }
        } else {
          renderPage(`/${rootPath}`, path, pageData, page);

          ret[path] = { context: pageData, page };
        }
      });
    } else {
      renderPage(`/${rootPath}`, path, {}, page);

      ret[path] = { context: {}, page };
    }
  }));

  return ret;
}

export { generateRoutes };
