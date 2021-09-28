import { cheerio } from "cheerio";

const getLibraries = async (category: string) => {
  const res = await fetch("https://jster.net/" + category);
  const html = await res.text();
  const $ = cheerio.load(html);
  const libraries: { title: string; url: string }[] = [];

  $(".repo .well a").each(function (_, e) {
    const url = $(e).attr("href");

    if (!url) {
      return;
    }

    const title = $("h3", e).text().trim();

    url && libraries.push({ title, url });
  });

  return libraries;
};

if (import.meta.main) {
  console.log(await getLibraries("/category/application-frameworks"));
}

export { getLibraries };
