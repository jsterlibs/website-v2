import type { Library } from "../../types.ts";
import { getJson } from "../../scripts/utils.ts";
import categories from "../../data/categories.json" assert {
  type: "json",
};

function getCategories() {
  return Promise.all(categories.map(async (
    category,
  ) => ({
    ...category,
    libraries: await getJson<Library[]>(`data/categories/${category.id}.json`),
  })));
}

export default getCategories;
