import { dir, getJson } from "utils";
import type { Library } from "../types.ts";

async function getLibraries(): Promise<Library[]> {
  const libraries = await dir("./data/libraries");

  return Promise.all(
    await libraries.map(({ path }) => getJson<Library>(path)),
  );
}

export default getLibraries;
