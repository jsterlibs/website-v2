// TODO: Prettier doesn't know what to do with "with"
import pluginDefinition from "../plugins.json" with { type: 'json'};

await Deno.writeTextFile("render.ts", generateCode());

// TODO: Alter this to work based on the new definition and pick only
// the server portions from the plugin definition.
//
// Another important thing to do is to convert path lookups into imports
// so that they can be bundled in.
//
// Both need adaptation at Gustwind.
function generateCode() {
  return `// IMPORTANT! This code has been generated, do not alter it directly
import { build } from "gustwind";
import { plugin } from "gustwind/plugins/meta/mod.ts";
import { initLoadApi } from "./utils/loadApi.ts";
import pluginDefinition from "./plugins.json";
${pluginDefinition.plugins
  .map(
    (plugin, i) =>
      `import p${i} from "` +
      plugin.path.replace("${GUSTWIND_VERSION}", "gustwind") +
      `";`
  )
  .join(`\n`)}
const plugins = [${pluginDefinition.plugins.map((_, i) => `p${i}`).join(", ")}];

// @ts-expect-error This is fine for now
pluginDefinition.plugins = pluginDefinition.plugins.map((p, i) => ({
  module: plugins[i].plugin,
  options: p.options,
}));

function render(layoutName: string, context: Record<string, unknown>) {
  console.log('plugin', plugin);
  console.log(build, pluginDefinition, layoutName, context);

  return build("./", initLoadApi, pluginDefinition, "blog");
}

export { render };`;
}
