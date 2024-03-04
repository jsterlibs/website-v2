import { plugin as edgeRouterPlugin } from "gustwind/plugins/edge-router";
import { plugin as htmlispEdgePlugin } from "gustwind/plugins/htmlisp-edge-renderer";
import { plugin as metaPlugin } from "gustwind/plugins/meta";
import { plugin as twindPlugin } from "gustwind/plugins/twind";
import * as globalUtilities from "./site/globalUtilities";
import twindSetup from "./site/twindSetup";
import meta from "./site/meta.json";

// The manifest is a generated file since the edge relies on static imports which
// complicates things a little.
import { components, componentUtilities } from "./manifest";

export default [
  edgeRouterPlugin.init({
    options: {
      routes: {
        library: {
          layout: "libraryPage",
          meta: {
            title: {
              utility: "get",
              parameters: ["context", "name"],
            },
            description: {
              utility: "get",
              parameters: ["context", "description"],
            },
          },
        },
      },
    },
  }),
  htmlispEdgePlugin.init({
    options: { components, componentUtilities, globalUtilities },
  }),
  metaPlugin.init({ options: { meta } }),
  twindPlugin.init({ options: { twindSetup } }),
];
