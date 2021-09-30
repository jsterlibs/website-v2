import { dir, getJsonSync, zipToObject } from "utils";
import type { Library } from "../types.ts";

function getLibraries() {
  return zipToObject<Library>(
    dir("./data/libraries").map((
      { name, path },
    ) => [name.split(".")[0], getJsonSync<Library>(path)]),
  );
}

export default getLibraries;
