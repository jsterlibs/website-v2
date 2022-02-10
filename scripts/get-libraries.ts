import { cheerio } from "https://deno.land/x/cheerio@1.0.4/mod.ts";
import { last } from "./utils.ts";
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

    url && libraries.push({ title, url, id: last(url.split("/")) });
  });

  return libraries;
};

if (import.meta.main) {
  console.log(await getLibraries("/category/application-frameworks"));
}

export { getLibraries };
