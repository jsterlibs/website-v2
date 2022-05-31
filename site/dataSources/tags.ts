import type { Category, Library } from "../../types.ts";
import { dir, getJson } from "../../scripts/utils.ts";

async function getTags(_: unknown, { libraries }: { libraries: Library[] }) {
  return Promise.all((await dir("assets/data/tags")).map(async (
    { name, path },
  ) => ({
    id: name.split(".").slice(0, -1).join(),
    title: name.split(".").slice(0, -1).join(),
    libraries: (await getJson<Category[]>(path)).map((c) => {
      const foundLibrary = libraries.find((l) => l.id === c.library.id);

      if (foundLibrary) {
        return foundLibrary;
      }
    }).filter(Boolean),
  })));
}

export default getTags;
