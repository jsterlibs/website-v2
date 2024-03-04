import { render } from "../../render.ts";

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
    const data = await fetch(url).then((res) => res.json());

    console.log("fetched data", data);

    console.log("render fn", render);

    // 2. TODO: Render through template
    const markup = await render("library", data as Record<string, unknown>);

    console.log("rendered markup", markup);

    // 3. TODO: Add data from GitHub and other sources + cache for a day
    return new Response(markup);
  } catch (error) {
    console.error(error);
  }

  return new Response("Not found", { status: 404 });
}
