// Example usage: vr write-libraries data/categories
import { ensureDirSync, expandGlobSync } from "fs";
import { join } from "path";
import { getLibrary } from "./get-library.ts";
import { getJsonSync } from "./utils.ts";

const writeLibraries = async (inputDirectory: string) => {
  console.log("Writing libraries");
  const categories = expandGlobSync(join(inputDirectory, "*.json"));
  const outputDirectory = "./data/libraries";

  ensureDirSync(outputDirectory);

  for (const category of categories) {
    const libraries = getJsonSync(category.path);

    for (const libraryName of libraries) {
      const library = await getLibrary(libraryName);
      const libraryPath = join(outputDirectory, libraryName + ".json");

      console.log(`Writing ${libraryName}`);
      Deno.writeTextFileSync(libraryPath, JSON.stringify(library));
    }
  }
};

if (import.meta.main) {
  if (Deno.args.length < 1) {
    console.error("Missing category input json");
  } else {
    try {
      writeLibraries(Deno.args[0]);
    } catch (error) {
      console.error(error);
    }
  }
}

export { writeLibraries };
