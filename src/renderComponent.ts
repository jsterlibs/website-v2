import { tw } from "twind";
import { getJsonSync } from "utils";
import * as primitives from "./primitives.ts";
import type { Attributes, Component, Components } from "../types.ts";

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
    return renderComponent(
      {
        children: Array.isArray(foundComponent) ? foundComponent : [{
          ...component,
          ...foundComponent,
          // TODO: See if class can be reduced to a string
          class: joinClasses(
            component.class as string,
            foundComponent.class as string,
          ),
          component: "",
        }],
      },
      components,
      context,
    );
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

function joinClasses(a?: string, b?: string) {
  if (a) {
    if (b) {
      return `${a} ${b}`;
    }

    return a;
  }

  return b || "";
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

export { renderComponent };
