import { Cheerio, cheerio, Root } from "cheerio";
import { last } from "./utils.ts";
import type { Category } from "../types.ts";

const getCategories = async () => {
  const res = await fetch("https://jster.net");
  const html = await res.text();
  const $ = cheerio.load(html);

  return selectCategories($, $(".category a"));
};

const selectCategories = ($: Root, $e: Cheerio) => {
  const categories: Category[] = [];

  $e.each(function (_, e) {
    const title = $(e).text();
    const url = $(e).attr("href");
    const id = last(url?.split("/") || []);

    url && categories.push({ id, title, url });
  });

  return categories;
};

if (import.meta.main) {
  console.log(JSON.stringify(await getCategories(), null, 2));
}

export { getCategories, selectCategories };
export type { Category };
