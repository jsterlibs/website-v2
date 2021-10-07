import { dir, getJsonSync, reversed, zipToObject } from "utils";

type Page = {
  meta: Record<string, string>;
  matchBy?: { dataSource: string; field: string };
  dataSources?: { name: string; transformWith: string }[];
};

async function generateRoutes(
  { renderPage, pagesPath }: {
    renderPage: (
      route: string,
      path: string,
      data: Record<string, unknown>,
    ) => void;
    pagesPath: string;
  },
) {
  const pages = (await dir(pagesPath)).map((o) => ({
    ...o,
    ...getJsonSync<Page>(o.path),
  }));

  pages.forEach(({ dataSources, matchBy, name, path }) => {
    let rootPath = name.split(".").slice(0, -1).join(".");
    rootPath = rootPath === "index" ? "" : rootPath;

    if (dataSources) {
      Promise.all(
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

            Object.values(dataSource).forEach((v) =>
              renderPage(
                `/${routerPath}/${v.id}`,
                path,
                { ...pageData, match: v },
              )
            );
          } else {
            console.warn(`Path ${rootPath} is missing a matchBy`);
          }
        } else {
          renderPage(`/${rootPath}`, path, pageData);
        }
      });
    } else {
      renderPage(`/${rootPath}`, path, {});
    }
  });
}

export { generateRoutes };
