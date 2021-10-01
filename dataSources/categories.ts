import { getJsonSync } from "utils";
import type { Category, Library } from "../types.ts";

function getCategories() {
  // TODO: Attach libraries to each category
  return getJsonSync<Category[]>("./data/categories.json").map((category) => ({
    ...category,
    libraries: getJsonSync<Library[]>(`data/categories/${category.id}.json`),
  }));
}

export default getCategories;
