import { plugin as htmlispEdgePlugin } from "gustwind/plugins/htmlisp-edge-renderer";
import { plugin as metaPlugin } from "gustwind/plugins/meta";
import type { Plugin, Route } from "gustwind";
import * as globalUtilities from "./site/globalUtilities.ts";
import meta from "./site/meta.json";

// The manifest is a generated file since the edge relies on static imports which
// complicates things a little.
import { components, componentUtilities } from "./manifest.ts";

const edgeRouterPlugin: Plugin<{ routes: Record<string, Route> }> = {
  meta: {
    name: "jster-edge-router-plugin",
    description: "Matches runtime routes without importing Node-only modules.",
  },
  init({ options: { routes } }) {
    return {
      getAllRoutes: () => ({
        routes,
        tasks: [],
      }),
      matchRoute: (url) => {
        const normalizedUrl = url.replace(/^\/+|\/+$/g, "");

        return routes[normalizedUrl] || routes[normalizedUrl.split("/")[0]];
      },
    };
  },
};

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
        category: {
          layout: "categoryPage",
          meta: {
            title: {
              utility: "get",
              parameters: ["context", "category.title"],
            },
            description: {
              utility: "get",
              parameters: ["context", "category.description"],
            },
          },
        },
        tag: {
          layout: "categoryPage",
          meta: {
            title: {
              utility: "get",
              parameters: ["context", "category.title"],
            },
            description: {
              utility: "get",
              parameters: ["context", "category.description"],
            },
          },
        },
        blog: {
          layout: "blogIndex",
          meta: {
            title: "JSter – Blog",
            description: "News relevant to JavaScript",
          },
        },
      },
    },
  ],
  [htmlispEdgePlugin, { components, componentUtilities, globalUtilities }],
  [metaPlugin, { meta }],
  [cssLinkPlugin, {}],
];
