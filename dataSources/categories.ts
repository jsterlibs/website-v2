import { getJson } from "utils";
import type { Category, Library } from "../types.ts";

async function getCategories() {
  const categories = await getJson<Category[]>("./data/categories.json");

  return Promise.all(categories.map(async (
    category,
  ) => ({
    ...category,
    libraries: await getJson<Library[]>(`data/categories/${category.id}.json`),
  })));
}

export default getCategories;
