import type { Library } from "../../types.ts";
import { getJson } from "../../scripts/utils.ts";
import categories from "../../assets/data/categories.json" assert {
  type: "json",
};
import getLibraries from "./libraries.ts";

async function getCategories() {
  const libraries = await getLibraries();

  // TODO: Point to the enhanced library data here (map by id)
  return Promise.all(categories.map(async (
    category,
  ) => ({
    ...category,
    libraries: await getJson<Library[]>(
      `assets/data/categories/${category.id}.json`,
    ),
  })));
}

export default getCategories;
