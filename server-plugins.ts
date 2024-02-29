import { plugin as htmlispEdgePlugin } from "gustwind/plugins/htmlisp-edge-renderer";
import { plugin as metaPlugin } from "gustwind/plugins/meta";
import { plugin as twindPlugin } from "gustwind/plugins/twind";
import * as globalUtilities from "./site/globalUtilities";
import twindSetup from "./site/twindSetup.node";
import meta from "./site/meta.json";

// The manifest is a generated file since the edge relies on static imports which
// complicates things a little.
import { components, componentUtilities } from "./manifest";

export default [
  htmlispEdgePlugin.init({ components, componentUtilities, globalUtilities }),
  metaPlugin.init({ meta }),
  twindPlugin.init({ twindSetup }),
];
