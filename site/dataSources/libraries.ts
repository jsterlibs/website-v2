// TODO: Figure out a good spot for this. Maybe Gustwind needs some init file?
import { configSync } from "https://deno.land/std@0.134.0/dotenv/mod.ts";
import { trim } from "https://deno.land/x/fae@v1.0.0/trim.ts";
import { pLimit } from "https://deno.land/x/p_limit@v1.0.0/mod.ts";
import { ensureFileSync } from "https://deno.land/std@0.141.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.141.0/path/mod.ts";
import { dir, getJson } from "../../scripts/utils.ts";
import type { Library } from "../../types.ts";

const config = configSync();

const cacheDirectory = ".gustwind_cache";

// TODO: Extract the cache logic as it's useful beyond this use case
async function getLibraries(): Promise<Library[]> {
  const libraries = await dir("./assets/data/libraries");
  const limit = pLimit(8);
  const enhancedLibraries = await Promise.all(
    await libraries.map(({ path }) =>
      limit(async () => {
        const library = await getJson<Library>(path);

        if (library.links.github) {
          const parts = library.links.github?.split("github.com/")[1];
          const [org, repository] = parts.split("/");

          if (!org || !repository) {
            return library;
          }

          // Check cache before requesting
          const cachePath = join(cacheDirectory, library.name + ".json");

          try {
            const cachedLibrary = JSON.parse(
              await Deno.readTextFile(cachePath),
            );

            if (cachedLibrary.stargazers === "undefined") {
              return;
            }

            return cachedLibrary;
          } catch (_error) {
            // no-op: Error here is ok as then it means the cache file doesn't exist yet
          }

          // TODO: The interesting point here that some repositories don't exist anymore!
          // This might require additional handling to filter them out.
          //
          // It looks like the missing repos have stargazers set to undefined.
          try {
            const response = await fetch(
              `https://cf-api.jster.net/stargazers?organization=${
                trim(org, "/")
              }&repository=${trim(repository, "/")}`,
              {
                headers: {
                  "Authorization": `Bearer ${config.API_AUTH}`,
                },
              },
            );
            const { stargazers } = await response.text().then((text) => {
              try {
                return JSON.parse(text);
              } catch (error) {
                console.error(
                  "Failed to parse",
                  error,
                  text,
                  library.links.github,
                );
              }

              return 0;
            });

            if (stargazers === "undefined") {
              return;
            }

            const ret = {
              ...library,
              stargazers,
            };

            console.log("Caching", library.name, "to", cachePath);

            // Write to cache
            ensureFileSync(cachePath);
            await Deno.writeTextFile(cachePath, JSON.stringify(ret, null, 2));

            return ret;
          } catch (error) {
            console.error("Failed to get stargazers", error);

            return library;
          }
        }

        return library;
      })
    ),
  );

  return enhancedLibraries.filter(Boolean);
}

export default getLibraries;
