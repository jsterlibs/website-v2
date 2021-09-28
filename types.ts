type Props = Record<string, string | undefined>;
// deno-lint-ignore no-explicit-any
type Attributes = Record<string, any>;
type Component = {
  component?: string;
  element?: string; // TODO: Only valid DOM element names
  children?: string | Component[];
  class?: string;
  attributes?: Attributes;
  transformWith?: "markdown";
  // Data bindings
  __bind?: string;
  __children?: string | Component[];
  __foreach?: {
    field: string;
    render: string | Component[];
  };
};
type Components = Record<string, Component>;
type Category = { id: string; title: string; url: string };
type Library = {
  description: string;
  logo?: string;
  name: string;
  links: {
    site?: string;
    github?: string;
  };
  tags: string[];
};

export type { Attributes, Category, Component, Components, Library, Props };
