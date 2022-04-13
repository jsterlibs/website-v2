import type { Library } from "../../types.ts";
import { getJson } from "../../scripts/utils.ts";
import categories from "../../assets/data/categories.json" assert {
  type: "json",
};

// TODO: Change this to refer to libraries by id and resolve to that data since it's enhanced
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
