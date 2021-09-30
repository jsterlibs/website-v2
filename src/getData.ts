import { Marked, Renderer } from "markdown";
import { dir, getJsonSync, zipToObject } from "utils";
import YAML from "yaml";
import type { BlogPost, Category, Library } from "../types.ts";

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

function getBlogPosts(indexPath: string, postsPath: string) {
  const blogIndex = getJsonSync<
    IndexEntry[]
  >(indexPath);
  const blogPosts: BlogPost[] = dir(postsPath).map(({ name, path }) => {
    const yaml = YAML.parse(Deno.readTextFileSync(path));

    return {
      name,
      path,
      ...yaml,
      // TODO: Support custom syntax (screenshots, anything else?)
      body: Marked.parse(yaml.body).content,
    };
  });

  return zipToObject<BlogPost>(
    blogIndex.map(({ id, date }: IndexEntry) => {
      const matchingBlogPost = blogPosts.find(({ slug }) => slug === id);

      if (!matchingBlogPost) {
        console.warn("No matching blog post found for", id);
      }

      return [id, {
        id,
        title: matchingBlogPost?.title || "",
        // @ts-ignore: Typo in the original data
        shortTitle: matchingBlogPost?.short_title,
        slug: matchingBlogPost?.slug || "",
        date,
        type: matchingBlogPost?.type || "static",
        user: matchingBlogPost?.user || "",
        body: matchingBlogPost?.body || "",
      }];
    }),
  );
}

function getCategories(p: string) {
  return zipToObject<Category>(
    getJsonSync<Category[]>(p).map((o: Category) => [o.id, o]),
  );
}

function getLibraries(
  p: string,
) {
  return zipToObject<Library>(
    dir(p).map((
      { name, path },
    ) => [name.split(".")[0], getJsonSync<Library>(path)]),
  );
}

export { getBlogPosts, getCategories, getLibraries };
