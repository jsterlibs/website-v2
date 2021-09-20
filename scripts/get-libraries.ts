import { cheerio } from "cheerio";
import { last } from "./utils.ts";

const getLibraries = async (category: string) => {
  const res = await fetch("https://jster.net/" + category);
  const html = await res.text();
  const $ = cheerio.load(html);
  const libraries: string[] = [];

  $(".repo .well a").each(function (_, e) {
    const library = $(e).attr("href");

    library && libraries.push(last<string>(library.split("/")));
  });

  return libraries;
};

if (import.meta.main) {
  console.log(await getLibraries("/category/application-frameworks"));
}

export { getLibraries };
