// Example usage: vr write-categories data/categories.json
import { ensureDirSync } from "fs";
import { join } from "path";
import { getLibraries } from "./get-libraries.ts";
import { getJsonSync, last } from "./utils.ts";

const writeCategories = async (inputDirectory: string) => {
  console.log("Writing categories");
  const categories = getJsonSync(inputDirectory);
  const outputDirectory = "./data/categories";

  ensureDirSync(outputDirectory);

  for (const category of categories) {
    const libraries = await getLibraries(category.url);
    const categoryPath = join(
      outputDirectory,
      last<string>(category.url.split("/")) + ".json",
    );

    Deno.writeTextFileSync(
      categoryPath,
      JSON.stringify(libraries),
    );
  }
};

if (import.meta.main) {
  if (Deno.args.length < 1) {
    console.error("Missing category input json");
  } else {
    try {
      writeCategories(Deno.args[0]);
    } catch (error) {
      console.error(error);
    }
  }
}

export { writeCategories };
