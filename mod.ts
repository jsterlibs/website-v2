import { Application, Router } from "oak";
import { getComponents, watch } from "utils";
import { generateRoutes } from "./src/generateRoutes.ts";
import { getPageRenderer } from "./src/getPageRenderer.ts";
import { getStyleSheet } from "./src/getStyleSheet.ts";
import { getWebsocketServer } from "./src/webSockets.ts";

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const wss = getWebsocketServer();
  const components = getComponents("./components.json");
  const app = new Application();
  const router = new Router();

  watch(
    ".",
    ".json",
    () => {
      wss.clients.forEach((socket) => {
        // 1 for open, https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
        if (socket.state === 1) {
          console.log("watch - Refresh ws");

          socket.send("refresh");
        }
      });
    },
  );

  const stylesheet = getStyleSheet();
  const renderPage = getPageRenderer({
    components,
    stylesheet,
    mode: "development",
    // TODO: Extract to meta.json
    siteMeta: { siteName: "JSter" },
  });
  await generateRoutes({
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
    pagesPath: "./pages",
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  await app.listen({ port });
}

// TODO: Make port configurable
serve(3000);
