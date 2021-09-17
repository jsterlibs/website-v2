import { cheerio } from "cheerio";

const getCategories = async () => {
  const res = await fetch("https://jster.net");
  const html = await res.text();
  const $ = cheerio.load(html);
  const categories: string[] = [];

  $(".category a").each(function (_, e) {
    const category = $(e).attr("href");

    category && categories.push(category);
  });

  return categories;
};

if (import.meta.main) {
  console.log(await getCategories());
}

export { getCategories };
