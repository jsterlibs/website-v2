import { render } from "../../render.ts";
import { ZLibrary } from "../../types.ts";

type Env = { API_AUTH: string };

const ONE_HOUR = 60 * 60;
const ONE_DAY = ONE_HOUR * 24;

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

    const { API_AUTH } = context.env;
    // TODO: Add data from GitHub and other sources

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

function fetchLibrary(name: string) {
  const url = `https://raw.githubusercontent.com/jsterlibs/website-v2/main/data/libraries/${name}.json`;

  return fetch(url).then((res) => res.json());
}
