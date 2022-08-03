import breeze from "breezewind";
import * as breezeExtensions from "breezewind/extensions";
import * as components from "../components";
import component from "../site/layouts/libraryPage.json";

export async function onRequest() {
  // TODO: Set up styling (twind)
  // TODO: Pass proper context here
  const html = await breeze({
    component,
    // @ts-ignore: Ignore the type for now
    components,
    context: {},
    extensions: [
      breezeExtensions.classShortcut,
      breezeExtensions.foreach,
      breezeExtensions.visibleIf,
    ],
  });

  return new Response(html, { headers: { "content-type": "text/html" } });
}
