type Props = Record<string, string | undefined>;
// deno-lint-ignore no-explicit-any
type Attributes = Record<string, any>;
type Component = {
  component?: string;
  element?: string; // TODO: Only valid DOM elements and components
  as?: string; // TODO: Only valid DOM elements
  children?: string | Component[];
  class?: string | ((props?: Props) => string);
  props?: Props;
  attributes?: Attributes | ((props?: Props) => Attributes);
};

export type { Attributes, Component, Props };
