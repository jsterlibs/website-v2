import { Cheerio, cheerio, Root } from "cheerio";

type Category = { title: string; url: string };

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

    url && categories.push({ title, url });
  });

  return categories;
};

if (import.meta.main) {
  console.log(JSON.stringify(await getCategories(), null, 2));
}

export { getCategories, selectCategories };
export type { Category };
