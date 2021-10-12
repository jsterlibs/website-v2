import { Application, Router } from "oak";
import { getComponents, watch } from "utils";
import { basename, join } from "path";
import { generateRoutes } from "./src/generateRoutes.ts";
import { getPageRenderer, renderBody } from "./src/getPageRenderer.ts";
import { getStyleSheet } from "./src/getStyleSheet.ts";
import { getWebsocketServer } from "./src/webSockets.ts";

async function serve(port: number, pagesPath: string) {
  console.log(`Serving at ${port}`);

  const wss = getWebsocketServer();
  const components = getComponents("./components.json");
  const app = new Application();
  const router = new Router();

  const stylesheet = getStyleSheet();
  const renderPage = getPageRenderer({
    components,
    stylesheet,
    mode: "development",
  });
  const { paths } = await generateRoutes({
    renderPage(route, path, context, page) {
      router.get(route, async (ctx) => {
        try {
          ctx.response.headers.set(
            "Content-Type",
            "text/html; charset=UTF-8",
          );

          const data = await renderPage(
            ctx.request.url.pathname,
            path,
            context,
            page,
          );

          ctx.response.body = new TextEncoder().encode(
            data,
          );
        } catch (err) {
          console.error(err);

          ctx.response.body = new TextEncoder().encode(err.stack);
        }
      });
    },
    pagesPath,
    // TODO: Extract to meta.json
    siteMeta: { siteName: "JSter" },
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  watch(
    ".",
    ".json",
    (matchedPath) => {
      wss.clients.forEach((socket) => {
        // 1 for open, https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
        if (socket.state === 1) {
          console.log("watch - Refresh ws");

          const pagePath = join(
            pagesPath,
            basename(matchedPath, import.meta.url),
          );
          const path = paths[pagePath];

          if (!path) {
            console.error(
              "Failed to find match for",
              matchedPath,
              "in",
              Object.keys(paths),
            );

            return;
          }

          const { context, page } = path;

          socket.send(
            JSON.stringify({
              type: "refresh",
              payload: renderBody(page.page, components, context, "/"),
              // TODO: Include meta as a separate field to be patched
              /*payload: {
                // TODO: Fix pathname
                bodyMarkup: renderBody(pageComponent, components, context, "/"),
                meta,
              },*/
            }),
          );
        }
      });
    },
  );

  await app.listen({ port });
}

// TODO: Make port configurable
serve(3000, "./pages");
