import { Marked, Renderer } from "markdown";
import { dir, getJsonSync } from "utils";
import YAML from "yaml";
import type { BlogPost } from "../types.ts";

type IndexEntry = { id: string; title: string; url: string; date: string };

// TODO: Set up highlighting
Marked.setOptions({
  renderer: new Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: true,
});

function getBlogPosts() {
  const blogIndex = getJsonSync<
    IndexEntry[]
  >("./data/blogposts.json");
  const blogPosts: BlogPost[] = dir("./data/blogposts").map(
    ({ name, path }) => {
      const yaml = YAML.parse(Deno.readTextFileSync(path));

      return {
        name,
        path,
        ...yaml,
        // TODO: Support custom syntax (screenshots, anything else?)
        body: Marked.parse(yaml.body).content,
      };
    },
  );

  return blogIndex.map(({ id, date }: IndexEntry) => {
    const matchingBlogPost = blogPosts.find(({ slug }) => slug === id);

    if (!matchingBlogPost) {
      console.warn("No matching blog post found for", id);
    }

    return {
      id,
      title: matchingBlogPost?.title || "",
      // @ts-ignore: Typo in the original data
      shortTitle: matchingBlogPost?.short_title,
      slug: matchingBlogPost?.slug || "",
      date,
      type: matchingBlogPost?.type || "static",
      user: matchingBlogPost?.user || "",
      body: matchingBlogPost?.body || "",
    };
  });
}

export default getBlogPosts;
