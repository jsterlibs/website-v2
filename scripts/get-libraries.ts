import { cheerio } from "cheerio";
import { last } from "./utils.ts";

const getLibraries = async (category: string) => {
  const res = await fetch("https://jster.net/" + category);
  const html = await res.text();
  const $ = cheerio.load(html);
  const libraries: { title: string; url: string }[] = [];

  $(".repo .well a").each(function (_, e) {
    const library = $(e).attr("href");

    if (!library) {
      return;
    }

    const title = $("h3", e).text().trim();
    const url = last<string>(library.split("/"));

    url && libraries.push({ title, url });
  });

  return libraries;
};

if (import.meta.main) {
  console.log(await getLibraries("/category/application-frameworks"));
}

export { getLibraries };
