import type { Library } from "../../types.ts";
import { getJson } from "../../scripts/utils.ts";
import categories from "../../assets/data/categories.json" assert {
  type: "json",
};

function getCategories() {
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
