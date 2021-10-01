import { cheerio } from "cheerio";
import type { Library } from "../types.ts";

const getLibrary = async (libraryName: string): Promise<Library> => {
  const res = await fetch("https://jster.net/library/" + libraryName);
  const html = await res.text();
  const $ = cheerio.load(html);
  const tags: string[] = [];

  $(".tags a").each(function (_, e) {
    const tag = $(e).text();

    tag && tags.push(tag);
  });

  return {
    id: libraryName,
    description: $(".desc").text().trim(),
    logo: $(".full_logo img").attr("src"),
    name: $("h1").text(),
    links: {
      site: $(".icon-home").next().attr("href"),
      github: $(".icon-github").next().attr("href"),
    },
    tags,
  };
};

if (import.meta.main) {
  console.log(await getLibrary("yui"));
}

export { getLibrary };
