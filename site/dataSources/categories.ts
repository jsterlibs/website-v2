import type { Library } from "../../types.ts";
import { getJson } from "../../scripts/utils.ts";
import categories from "../../assets/data/categories.json" assert {
  type: "json",
};
import getLibraries from "./libraries.ts";

async function getCategories() {
  const libraries = await getLibraries();

  return Promise.all(categories.map(async (
    category,
  ) => ({
    ...category,
    libraries: (await getJson<Library[]>(
      `assets/data/categories/${category.id}.json`,
    )).map((l) => libraries.find((library) => library.id === l.id)).filter(
      Boolean,
    ),
  })));
}

export default getCategories;
