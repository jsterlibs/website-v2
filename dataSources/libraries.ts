import { dir, getJsonSync } from "utils";
import type { Library } from "../types.ts";

function getLibraries(): Library[] {
  return dir("./data/libraries").map(({ path }) => getJsonSync<Library>(path));
}

export default getLibraries;
