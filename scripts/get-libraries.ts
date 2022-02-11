import { cheerio } from "https://deno.land/x/cheerio@1.0.4/mod.ts";
import { getJsonSync, last } from "./utils.ts";
import type { Category } from "../types.ts";

const getLibraries = async (category: string) => {
  const res = await fetch("https://jster.net/" + category);
  const html = await res.text();
  const $ = cheerio.load(html);
  const libraries: Category[] = [];

  $(".repo .well a").each(function (_, e) {
    const url = $(e).attr("href");

    if (!url) {
      return;
    }

    const title = $("h3", e).text().trim();
    const id = last(url.split("/"));

    url &&
      libraries.push({
        title,
        url,
        id,
        library: getJsonSync(`./data/libraries/${id}.json`),
      });
  });

  return libraries;
};

if (import.meta.main) {
  console.log(await getLibraries("/category/application-frameworks"));
}

export { getLibraries };
