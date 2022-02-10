// Example usage: vr write-tags
import { ensureDirSync } from "https://deno.land/std@0.107.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.107.0/path/mod.ts";
import { dir, getJsonSync } from "./utils.ts";
import type { Category, Library } from "../types.ts";

const writeTags = async () => {
  console.log("Writing tags");
  const libraries = Object.fromEntries(
    (await dir("./data/libraries")).map(({ path }) => {
      const data = getJsonSync<Library>(path);

      return [data.id, data];
    }),
  );
  const allTags: Record<string, Category[]> = {};

  Object.values(libraries).forEach(({ id, name: title, tags }) => {
    const o: Category = { title, url: `/library/${id}`, id };

    tags.forEach((tag) => {
      if (allTags[tag]) {
        allTags[tag].push(o);
      } else {
        allTags[tag] = [o];
      }
    });
  });

  const outputDirectory = "./data/tags";

  ensureDirSync(outputDirectory);

  Object.entries(allTags).forEach(([name, tags]) => {
    const tagPath = join(outputDirectory, name + ".json");

    Deno.writeTextFileSync(
      tagPath,
      JSON.stringify(tags),
    );
  });
};

if (import.meta.main) {
  try {
    writeTags();
  } catch (error) {
    console.error(error);
  }
}

export { writeTags };
