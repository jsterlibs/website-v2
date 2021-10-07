import { getJson } from "utils";
import type { ParentCategory } from "../types.ts";

function getParentCategories() {
  return getJson<ParentCategory[]>("./data/parent-categories.json");
}

export default getParentCategories;
