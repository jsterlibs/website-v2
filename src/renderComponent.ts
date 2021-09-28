import { tw } from "twind";
import { getJsonSync } from "utils";
import { Marked } from "markdown";
import type {
  Attributes,
  Component,
  Components,
  DataContext,
} from "../types.ts";

function renderComponent(
  component: Component | string,
  components: Components,
  context: DataContext,
): string {
  if (typeof component === "string") {
    return component;
  }

  const foundComponent = components[component.component!];

  if (component.__bind) {
    context = getJsonSync(component.__bind);
  }

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

    children = childrenToRender.flatMap((c: DataContext) =>
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
    component.element,
    generateAttributes({
      ...component.attributes,
      class: component.class && tw(component.class),
    }, context),
    transform(children, component?.transformWith),
  );
}

function transform(children?: string, transformWith?: string) {
  if (transformWith === "markdown" && typeof children === "string") {
    return Marked.parse(children).content;
  }

  return children || "";
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

function generateAttributes(attributes: Attributes, context: DataContext) {
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

export { renderComponent };
