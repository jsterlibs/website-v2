import { Marked, Renderer } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import YAML from "https://esm.sh/yaml@1.10.2";
import { dir } from "../../scripts/utils.ts";
import type { BlogPost } from "../../types.ts";
import blogIndex from "../../assets/data/blogposts.json" assert {
  type: "json",
};

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

async function getBlogPosts() {
  const blogPosts: BlogPost[] = (await dir("./assets/data/blogposts")).map(
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

  const ret = blogIndex.map(({ id, date }: IndexEntry) => {
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

  // TODO: Likely this should be applied as a transform
  return [...ret].reverse();
}

export default getBlogPosts;
