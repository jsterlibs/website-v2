import { render } from "../../render.ts";
import { ZLibrary, type Library } from "../../types.ts";

type Env = { API_AUTH: string };

const ONE_HOUR = 60 * 60;
const ONE_DAY = ONE_HOUR * 24;

// TODO: Pull readme markdown from GitHub to render
// Reference: https://developers.cloudflare.com/workers/examples/cache-using-fetch/
export async function onRequest(
  context: ExecutionContext & { params: { name?: string }; env: Env }
): Promise<Response> {
  const { name } = context.params;

  if (!name) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const library = await fetchLibrary(name);

    // In case library does not have a valid shape, this will throw
    ZLibrary.parse(library);

    const stargazers = await fetchStargazers(
      context.env.API_AUTH,
      library.links?.github
    );

    if (stargazers) {
      library.stargazers = stargazers;
    }

    const security = await fetchSecurity(context.env.API_AUTH, library.name);

    if (security) {
      library.security = security;
    }

    const { markup } = await render("library", { library });

    return new Response(markup, {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        // Cache results at the browser for one day
        "Cache-Control": `max-age=${ONE_DAY}`,
      },
    });
  } catch (error) {
    console.error(error);
  }

  return new Response("Not found", {
    status: 404,
  });
}

function fetchLibrary(name: string): Promise<Library> {
  const url = `https://raw.githubusercontent.com/jsterlibs/website-v2/main/data/libraries/${name}.json`;

  return fetch(url).then((res) => res.json());
}

async function fetchSecurity(
  apiAuth: string,
  name: string
): Promise<Library["security"]> {
  try {
    const metrics = await fetch(
      `https://cf-api.jster.net/security?name=${name}`,
      {
        headers: {
          Authorization: `Bearer ${apiAuth}`,
        },
      }
    ).then((res) => res.json<{ stargazers: number }>());

    return metrics;
  } catch (error) {}
}

async function fetchStargazers(
  apiAuth: string,
  githubUrl?: string
): Promise<Library["stargazers"]> {
  if (!githubUrl) {
    return;
  }

  const parts = githubUrl.split("github.com/")[1];
  const [org, repository] = parts.split("/");

  if (!org || !repository) {
    return;
  }

  try {
    const { stargazers } = await fetch(
      `https://cf-api.jster.net/stargazers?organization=${trim(
        org,
        "/"
      )}&repository=${trim(repository, "/")}`,
      {
        headers: {
          Authorization: `Bearer ${apiAuth}`,
        },
      }
    ).then((res) => res.json<{ stargazers: number }>());

    return stargazers;
  } catch (error) {}
}

// https://stackoverflow.com/a/32516190/228885
function trim(s: string, c: string) {
  if (c === "]") c = "\\]";
  if (c === "^") c = "\\^";
  if (c === "\\") c = "\\\\";
  return s?.replace(new RegExp("^[" + c + "]+|[" + c + "]+$", "g"), "");
}
