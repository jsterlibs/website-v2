import { getJsonSync } from "utils";
import type { Category } from "../types.ts";

function getCategories() {
  return getJsonSync<Category[]>("./data/categories.json");
}

export default getCategories;
