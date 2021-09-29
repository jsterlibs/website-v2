import { Cheerio, cheerio, Root } from "cheerio";
import { last } from "./utils.ts";

const getBlogPosts = async () => {
  const res = await fetch("https://jster.net/blog");
  const html = await res.text();
  const $ = cheerio.load(html);

  return selectBlogPosts($, $(".post"));
};

const selectBlogPosts = ($: Root, $e: Cheerio) => {
  const categories: { id: string; title: string; url: string; date: string }[] =
    [];

  $e.each(function (_, e) {
    const title = $("h2 a", e).text();
    const url = $("h2 a", e).attr("href");
    const date = last($(".notice .small", e).text().split(" on ")).trim();

    url &&
      categories.push({
        id: last(url.split("/")),
        title,
        url,
        date,
      });
  });

  categories.reverse();

  return categories;
};

if (import.meta.main) {
  console.log(JSON.stringify(await getBlogPosts(), null, 2));
}

export { getBlogPosts, selectBlogPosts };
