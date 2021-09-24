import { isObject } from "utils";
import type { Component } from "../types.ts";

const box: Component = {
  element: "div",
};

const flex: Component = {
  element: "box",
  class: (props) =>
    `flex ${
      convertToClasses(
        "flex",
        (mediaQuery, prefix, v) =>
          `${mediaQuery ? mediaQuery + ":" : ""}${prefix}-${
            v === "column" ? "col" : "row"
          }`,
      )(props?.direction)
    } ${(props?.sx && props.sx) || ""}`.trim(),
};

const stack: Component = {
  element: "flex",
  class: (props) =>
    `flex ${
      convertToClasses(
        "flex",
        (mediaQuery, prefix, v) =>
          `${mediaQuery ? mediaQuery + ":" : ""}${prefix}-${
            v === "column" ? "col" : "row"
          }`,
      )(props?.direction)
    } ${
      parseSpacingClass(
        props?.direction,
        props?.spacing,
      )
    } ${(props?.sx && props.sx) || ""}`.trim(),
};

function parseSpacingClass(
  direction?: string,
  spacing?: string,
) {
  if (!spacing) {
    return "";
  }

  return convertToClasses("space", (mediaQuery, prefix, direction) => {
    const klass = `${mediaQuery ? mediaQuery + ":" : ""}${prefix}-${
      direction === "row" ? "x" : "y"
    }-${spacing}`;
    const inverseClass = `${mediaQuery ? mediaQuery + ":" : ""}${prefix}-${
      direction === "row" ? "y" : "x"
    }-0`;

    return `${klass} ${inverseClass}`;
  })(direction);
}

function convertToClasses(prefix: string, customizeValue = defaultValue) {
  // deno-lint-ignore no-explicit-any
  return (value?: any) => {
    if (!value) {
      return "";
    }

    if (isObject(value)) {
      return Object.entries(value).map(([k, v]) =>
        customizeValue(k === "default" ? "" : k, prefix, v as string)
      );
    }

    return customizeValue("", prefix, value);
  };
}

function defaultValue(
  mediaQuery: string,
  prefix: string,
  value: string | number,
) {
  return `${mediaQuery ? mediaQuery + ":" : ""}${prefix}-${value}`;
}

export { box, flex, stack };
