import { getJsonSync } from "utils";
import type { ParentCategory } from "../types.ts";

function getParentCategories() {
  return getJsonSync<ParentCategory[]>(
    "./data/parent-categories.json",
  );
}

export default getParentCategories;
