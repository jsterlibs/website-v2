// Import maps aren't supported in workers yet
// https://github.com/denoland/deno/issues/6675
import { ensureDirSync } from "https://deno.land/std@0.107.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.107.0/path/mod.ts";
import { getComponents } from "./utils.ts";
import { getPageRenderer } from "../src/getPageRenderer.ts";
import { getStyleSheet } from "../src/getStyleSheet.ts";

declare global {
  interface Window {
    onmessage: typeof onmessage;
    renderPage: ReturnType<typeof getPageRenderer>;
  }
}

const onmessage = (
  { data: { event, data: { outputDirectory, route, path, context } } }: {
    data: {
      event: "init" | "render";
      data: {
        outputDirectory: string;
        route: string;
        path: string;
        context: Record<string, unknown>;
      };
    };
  },
) => {
  if (event === "init") {
    const components = getComponents("./components.json");
    const stylesheet = getStyleSheet();

    self.renderPage = getPageRenderer({
      components,
      stylesheet,
      mode: "production",
      // TODO: Extract to meta.json
      siteMeta: { siteName: "JSter" },
    });
  }

  if (event === "render") {
    // TODO: Push this behind a verbose flag
    // console.log("Building", route);

    const dir = join(outputDirectory, route);

    ensureDirSync(dir);

    Deno.writeTextFileSync(
      join(dir, "index.html"),
      self.renderPage(route, path, context),
    );
  }
};

self.onmessage = onmessage;
