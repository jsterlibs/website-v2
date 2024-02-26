import * as path from "https://deno.land/std@0.207.0/path/mod.ts";
import { dir } from "./utils.ts";

// TODO: Generate a file containing components and layouts as strings + include references to their server-side logic to bundle
generateRenderLayout();

async function generateRenderLayout() {
  const siteRoot = path.join(Deno.cwd(), "site");

  const layouts = await dir(path.join(siteRoot, "layouts"));
  const components = await dir(path.join(siteRoot, "components"));

  // TODO: Pull data from html files
  // console.log(layouts);
  // console.log(components);

  await Deno.writeTextFile("render.ts", generateCode());
}

// TODO: Maybe the real solution to this problem is to allow Gustwind plugin system
// to be run directly in Node!
function generateCode() {
  return `// IMPORTANT! This code has been generated, do not alter it directly
import { htmlToBreezewind } from 'htmlisp';
import breezewind from 'breezewind';
import breezewindExtensions from 'breezewind';
// TODO: Import and initialize twind

// TODO: Include global utilities
const globalUtilities = {};

// TODO: Include component utilities (set up imports per component)
const componentUtilities = {};

// TODO: Include layouts
const layouts = {};

// TODO: Include components
const components = {};

function render(layoutName: string, context: Record<string, unknown>) {
  // TODO: Initialize rendering logic
  return breezewind({
    component: layouts[layoutName],
    components: { ...layouts, ...components },
    extensions: [
      breezewindExtensions.visibleIf,
      breezewindExtensions.foreach,
    ],
    context,
    globalUtilities,
    componentUtilities,
  });
}

export { render };`;
}
