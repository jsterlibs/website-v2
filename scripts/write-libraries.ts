// Example usage: vr write-libraries assets/data/categories
import { ensureDirSync, expandGlobSync } from "fs";
import { join } from "path";
import { getLibrary } from "./get-library.ts";
import { getJsonSync } from "./utils.ts";
import type { Library } from "../types.ts";

const writeLibraries = async (inputDirectory: string) => {
  console.log("Writing libraries");
  const categories = expandGlobSync(join(inputDirectory, "*.json"));
  const outputDirectory = "./assets/data/libraries";

  ensureDirSync(outputDirectory);

  for (const category of categories) {
    const libraries = getJsonSync<Library[]>(category.path);

    for (const { name } of libraries) {
      const library = await getLibrary(name);
      const libraryPath = join(outputDirectory, name + ".json");

      console.log(`Writing ${name}`);
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
