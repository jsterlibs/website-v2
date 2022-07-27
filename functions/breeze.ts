import breeze from "breezewind";
import * as breezeExtensions from "breezewind/extensions";

// https://github.com/cloudflare/workers-types
export async function onRequest(context) {
  // Contents of context object
  const {
    request, // same as existing Worker API
    env, // same as existing Worker API
    params, // if filename includes [id] or [[path]]
    waitUntil, // same as ctx.waitUntil in existing Worker API
    next, // used for middleware or to fetch assets
    data, // arbitrary space for passing data between middlewares
  } = context;

  // TODO: Expand this and render a real layout with content here
  const html = await breeze({
    component: {
      element: "div",
      children: "hello world",
    },
    components: {},
    context: {},
    extensions: [
      breezeExtensions.classShortcut,
      breezeExtensions.foreach,
      breezeExtensions.visibleIf,
    ],
  });

  return new Response(html, { headers: { "content-type": "text/html" } });
}
