import type { Category } from "../../types.ts";
import { dir, getJson } from "../../scripts/utils.ts";
import getLibraries from "./libraries.ts";

async function getTags() {
  const libraries = await getLibraries();

  return Promise.all((await dir("assets/data/tags")).map(async (
    { name, path },
  ) => ({
    id: name.split(".").slice(0, -1).join(),
    title: name.split(".").slice(0, -1).join(),
    libraries: (await getJson<Category[]>(path)).map((c) => ({
      ...c,
      library: libraries.find((l) => l.id === c.library.id),
    })),
  })));
}

export default getTags;
