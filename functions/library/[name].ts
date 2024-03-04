import { initRender } from "../../render.ts";

export async function onRequest(
  context: ExecutionContext & { params: { name?: string } }
): Promise<Response> {
  const { name } = context.params;

  if (!name) {
    return new Response("Not found", { status: 404 });
  }

  const url = `https://raw.githubusercontent.com/jsterlibs/website-v2/main/data/libraries/${name}.json`;

  try {
    // TODO: Validate the shape of the data here
    const library = await fetch(url).then((res) => res.json());
    const render = await initRender();

    const { markup } = await render("library", { library });

    // TODO: Add data from GitHub and other sources + cache for a day
    return new Response(markup, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  } catch (error) {
    console.error(error);
  }

  return new Response("Not found", { status: 404 });
}
