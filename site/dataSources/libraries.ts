// TODO: Figure out a good spot for this. Maybe Gustwind needs some init file?
import { configSync } from "https://deno.land/std@0.134.0/dotenv/mod.ts";
import { trim } from "https://deno.land/x/fae@v1.0.0/trim.ts";
import { pLimit } from "https://deno.land/x/p_limit@v1.0.0/mod.ts";
import { dir, getJson } from "../../scripts/utils.ts";
import type { Library } from "../../types.ts";

const config = configSync();

// TODO: Figure out a better way to cache all this so that CF doesn't need to be hit always
async function getLibraries(): Promise<Library[]> {
  const libraries = await dir("./assets/data/libraries");
  const limit = pLimit(8);
  return Promise.all(
    await libraries.map(({ path }) =>
      limit(async () => {
        const library = await getJson<Library>(path);

        if (library.links.github) {
          const parts = library.links.github?.split("github.com/")[1];
          const [org, repository] = parts.split("/");

          if (!org || !repository) {
            return library;
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

            return {
              ...library,
              stargazers,
            };
          } catch (error) {
            console.error("Failed to get stargazers", error);

            return library;
          }
        }

        return library;
      })
    ),
  );
}

export default getLibraries;
