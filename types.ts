// deno-lint-ignore no-explicit-any
type Attributes = Record<string, any>;
type Category = { id: string; title: string; url: string; library: Library };
type Library = {
  id: string;
  description: string;
  logo?: string;
  name: string;
  links: {
    site?: string;
    github?: string;
  };
  tags: string[];
  stargazers?: number;
};
type DataContext = Record<string, unknown> | Record<string, unknown>[];
type ParentCategory = { title: string; children: Category[] };
type BlogPost = {
  path: string;
  id: string;
  title: string;
  shortTitle: string;
  slug: string;
  date: string;
  type: "comparison" | "interview" | "rating" | "static";
  user: string;
  includes?: string[];
  body: string;
  footer?: string;
  table?: Record<string, string[]>;
  profile?: {
    name: string;
    twitter: string;
    github: string;
    bio: string;
    photo: string;
  };
};
type Tag = {
  id: string;
  title: string;
  libraries: Library[];
};

export type {
  Attributes,
  BlogPost,
  Category,
  DataContext,
  Library,
  ParentCategory,
  Tag,
};
