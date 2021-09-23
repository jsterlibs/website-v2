import { Application } from "oak";
import { setup, tw } from "twind";
import { getStyleTag, virtualSheet } from "twind-sheets";
import * as colors from "twind-colors";
import { getJsonSync } from "utils";
import * as primitives from "./primitives.ts";
import type { Attributes, Component } from "./types.ts";

type Meta = Record<string, string>;
type Components = Record<string, Component[]>;

async function serve(port: number) {
  console.log(`Serving at ${port}`);

  const siteTitle = "JSter – JavaScript Catalog";
  const document: Component = getJsonSync("./site.json");
  const components: Components = getJsonSync("./components.json");
  const stylesheet = getStyleSheet();
  const app = new Application();

  app.use((context) => {
    try {
      const body = renderComponent(
        {
          element: "main",
          children: Array.isArray(document) ? document : [document],
        },
        components,
        [],
      );
      const styleTag = getStyleTag(stylesheet);

      context.response.headers.set("Content-Type", "text/html; charset=UTF-8");
      context.response.body = new TextEncoder().encode(
        htmlTemplate({ title: siteTitle, head: styleTag, body }),
      );
    } catch (err) {
      console.error(err);

      context.response.body = new TextEncoder().encode(err.stack);
    }
  });

  await app.listen({ port });
}

type Context = Record<string, unknown> | Record<string, unknown>[];

function renderComponent(
  component: Component | string,
  components: Components,
  context: Context,
): string {
  if (typeof component === "string") {
    return component;
  }

  const foundComponent = components[component.component!];

  if (foundComponent) {
    return renderComponent({ children: foundComponent }, components, context);
  }

  if (component.__bind) {
    context = getJsonSync(component.__bind);
  }

  const foundPrimitive =
    (primitives as Record<string, Component>)[component.element!];
  const element = component.as
    ? component.as
    : foundPrimitive
    ? foundPrimitive.element
    : component.element;
  let children: string | undefined;

  if (component.__children && context) {
    const boundChildren = component.__children;

    if (typeof boundChildren === "string") {
      // @ts-ignore: TODO: How to type this?
      children = context[boundChildren];
    } else {
      children = (Array.isArray(context) ? context : [context]).flatMap((d) =>
        boundChildren.map((c) => renderComponent(c, components, d))
      )
        .join("");
    }
  } else if (component.__foreach) {
    const { field, render } = component.__foreach;

    // @ts-ignore: TODO: How to type this?
    const childrenToRender = context[field];

    children = childrenToRender.flatMap((c: Context) =>
      Array.isArray(render)
        ? render.map((r) => renderComponent(r, components, c))
        : renderComponent(render, components, c)
    ).join("");
  } else {
    children = Array.isArray(component.children)
      ? component.children.map((component) =>
        renderComponent(component, components, context)
      ).join("")
      : component.children;
  }

  return wrapInElement(
    element,
    generateAttributes({
      ...(typeof component.attributes === "function"
        ? component.attributes(component.props)
        : component.attributes),
      class: getClasses(foundPrimitive, component),
    }, context),
    children,
  );
}

function wrapInElement(
  element: Component["element"],
  attributes: string,
  children?: string,
): string {
  if (!element) {
    return children || "";
  }

  return `<${element}${attributes}>${children}</${element}>`;
}

function generateAttributes(attributes: Attributes, context: Context) {
  const ret = Object.entries(attributes).map(([k, v]) => {
    if (k.startsWith("__")) {
      // @ts-ignore: TODO: How to type this?
      return `${k.slice(2)}="${context[v]}"`;
    }

    return v && `${k}="${v}"`;
  })
    .filter(Boolean).join(
      " ",
    );

  return ret.length > 0 ? " " + ret : "";
}

function getClasses(baseComponent: Component, component: Component) {
  const baseClass = baseComponent &&
    getClass(baseComponent.class, component.props);
  const componentClass = getClass(component.class, component.props);

  return `${baseClass ? baseClass + " " : ""}${componentClass}`;
}

function getClass(kls: Component["class"], props: Component["props"]) {
  if (typeof kls === "function") {
    return tw(kls(props));
  }

  return kls ? tw(kls) : "";
}

// TODO: Extract script + link bits (too specific)
function htmlTemplate(
  { title, meta, head, body }: {
    title: string;
    meta?: Meta;
    head?: string;
    body?: string;
  },
) {
  return `<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || ""}</title>
    <script type="text/javascript" src="https://unpkg.com/sidewind@3.3.3/dist/sidewind.umd.production.min.js"></script>
    <script type="text/javascript" src="https://livejs.com/live.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/tailwindcss@2.0.1/dist/base.min.css" />
    ${generateMeta(meta)}
    ${head || ""}
  </head>
  <body>${body || ""}</body>
</html>`;
}

function generateMeta(meta?: Meta) {
  if (!meta) {
    return "";
  }

  return Object.entries(meta).map(([key, value]) =>
    `<meta name="${key}" content="${value}"></meta>`
  ).join("\n");
}

// https://twind.dev/handbook/the-shim.html#server
function getStyleSheet() {
  const sheet = virtualSheet();

  setup({ sheet, theme: { colors } });

  return sheet;
}

// TODO: Make this configurable
const port = 3000;

serve(port);
