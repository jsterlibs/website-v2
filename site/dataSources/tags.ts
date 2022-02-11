import type { Category } from "../../types.ts";
import { dir, getJson } from "../../scripts/utils.ts";

async function getTags() {
  return Promise.all((await dir("data/tags")).map(async (
    { name, path },
  ) => ({
    id: name.split(".").slice(0, -1).join(),
    title: name.split(".").slice(0, -1).join(),
    libraries: await getJson<Category[]>(path),
  })));
}

export default getTags;
