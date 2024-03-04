import { plugin as edgeRouterPlugin } from "gustwind/plugins/edge-router";
import { plugin as htmlispEdgePlugin } from "gustwind/plugins/htmlisp-edge-renderer";
import { plugin as metaPlugin } from "gustwind/plugins/meta";
import { plugin as twindPlugin } from "gustwind/plugins/twind";
import * as globalUtilities from "./site/globalUtilities.ts";
import twindSetup from "./site/twindSetup.ts";
import meta from "./site/meta.json";

// The manifest is a generated file since the edge relies on static imports which
// complicates things a little.
import { components, componentUtilities } from "./manifest";

export default [
  [
    edgeRouterPlugin,
    {
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
  ],
  [htmlispEdgePlugin, { components, componentUtilities, globalUtilities }],
  [metaPlugin, { meta }],
  [twindPlugin, { twindSetup }],
];
