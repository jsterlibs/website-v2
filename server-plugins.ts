import { plugin as edgeRouterPlugin } from "gustwind/plugins/edge-router";
import { plugin as htmlispEdgePlugin } from "gustwind/plugins/htmlisp-edge-renderer";
import { plugin as metaPlugin } from "gustwind/plugins/meta";
import type { Plugin } from "gustwind";
import * as globalUtilities from "./site/globalUtilities.ts";
import meta from "./site/meta.json";

// The manifest is a generated file since the edge relies on static imports which
// complicates things a little.
import { components, componentUtilities } from "./manifest.ts";

const cssLinkPlugin: Plugin = {
  meta: {
    name: "jster-css-link-plugin",
    description: "Injects the compiled stylesheet for runtime edge renders.",
  },
  init() {
    return {
      afterEachRender({ markup, url }) {
        if (url.endsWith(".xml")) {
          return { markup };
        }

        return {
          markup: markup.includes("</head>")
            ? markup.replace(
                "</head>",
                '<link rel="stylesheet" href="/assets/site.css"></head>',
              )
            : markup,
        };
      },
    };
  },
};

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
  [cssLinkPlugin, {}],
];
