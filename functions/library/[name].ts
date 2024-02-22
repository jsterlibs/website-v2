// TODO: How to import template and related components?
// import libraryPage from "../../site/layouts/libraryPage.html" with { type: "file" };

export async function onRequest(
  context: ExecutionContext & { params: { name?: string } },
): Promise<Response> {
  const { name } = context.params;

  if (!name) {
    return new Response("Not found", { status: 404 });
  }

  const url =
    `https://raw.githubusercontent.com/jsterlibs/website-v2/main/data/libraries/${name}.json`;

  try {
    // 1. Get library data somehow (fetch from the site itself or from github?)
    const data = await fetch(url).then((res) => res.json());

    // 2. TODO: Render through template
    // 3. TODO: Later - add data from GitHub and other sources + cache for a day
    return new Response(`Hello, ${JSON.stringify(data, null, 2)}!`);
  } catch (error) {}

  return new Response("Not found", { status: 404 });
}
