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

function generateCode() {
  return `import { htmlToBreezewind } from 'htmlisp';
import breezewind from 'breezewind';
import breezewindExtensions from 'breezewind';
// TODO: Import and initialize twind

// TODO: Include global utilities
// TODO: Include components
// TODO: Include utilities (set up imports per component)
// TODO: Do the same for layouts -> likely possible to reduce to the same problem

function render(ctx: Record<string, unknown>) {
  // TODO: Initialize rendering logic
  return 'hello from render';
}

export { render };`;
}
