import { cheerio } from "cheerio";
import { selectCategories } from "./get-categories.ts";
import type { Category } from "./get-categories.ts";

const getParentCategories = async () => {
  const res = await fetch("https://jster.net");
  const html = await res.text();
  const $ = cheerio.load(html);
  const parentCategories: { title: string; children: Category[] }[] = [];

  $(".row").each(function (_, e) {
    const title = $(".meta", e).text();

    title &&
      parentCategories.push({
        title,
        children: selectCategories($, $(".category a", e)),
      });
  });

  return parentCategories;
};

if (import.meta.main) {
  console.log(JSON.stringify(await getParentCategories(), null, 2));
}

export { getParentCategories };
