import { cheerio } from "cheerio";

const getCategories = async () => {
  const res = await fetch("https://jster.net");
  const html = await res.text();
  const $ = cheerio.load(html);
  const categories: { title: string; url: string }[] = [];

  $(".category a").each(function (_, e) {
    const title = $(e).text();
    const url = $(e).attr("href");

    url && categories.push({ title, url });
  });

  return categories;
};

if (import.meta.main) {
  console.log(JSON.stringify(await getCategories(), null, 2));
}

export { getCategories };
