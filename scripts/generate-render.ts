import * as path from "https://deno.land/std@0.207.0/path/mod.ts";
// import { dir } from "./utils.ts";

// TODO: Generate a file containing components and layouts as strings + include references to their server-side logic to bundle
generateRenderLayout();

async function generateRenderLayout() {
  const siteRoot = path.join(Deno.cwd(), "site");

  // const layouts = await dir(path.join(siteRoot, "layouts"));
  // const components = await dir(path.join(siteRoot, "components"));

  // TODO: Pull data from html files
  // console.log(layouts);
  // console.log(components);

  await Deno.writeTextFile("render.ts", generateCode());
}

function generateCode() {
  return `// IMPORTANT! This code has been generated, do not alter it directly
import { build } from "gustwind";
import { initLoadApi } from "./utils/loadApi.ts";
import plugins from "./plugins.json";

function render(layoutName: string, context: Record<string, unknown>) {
  console.log(build, plugins, layoutName, context);

  return build(initLoadApi, plugins, "blog")
}

export { render };`;
}
