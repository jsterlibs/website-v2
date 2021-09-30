import { getJsonSync, zipToObject } from "utils";
import type { Category } from "../types.ts";

function getCategories() {
  return zipToObject<Category>(
    getJsonSync<Category[]>("./data/categories.json").map((
      o: Category,
    ) => [o.id, o]),
  );
}

export default getCategories;
