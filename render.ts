import { build } from "gustwind";
import pluginDefinition from "./server-plugins";
import { initLoadApi } from "./utils/loadApi";

function render(layoutName: string, context: Record<string, unknown>) {
  console.log(build, pluginDefinition, layoutName, context);

  // TODO: Figure out how this should work without a router
  // return build("./", initLoadApi, pluginDefinition, "blog");
  return "foobar";
}

export { render };
