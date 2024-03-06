import { z } from "zod";

// deno-lint-ignore no-explicit-any
type Attributes = Record<string, any>;
type Category = { id: string; title: string; url: string; library: Library };

const ZLibrary = z.object({
  id: z.string(),
  description: z.string(),
  logo: z.string().optional(),
  name: z.string(),
  links: z.object({
    site: z.string().optional(),
    github: z.string().optional(),
  }),
  tags: z.array(z.string()),
  stargazers: z.number().optional(),
});
type Library = z.infer<typeof ZLibrary>;

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

export { ZLibrary };
export type {
  Attributes,
  BlogPost,
  Category,
  DataContext,
  Library,
  ParentCategory,
  Tag,
};
