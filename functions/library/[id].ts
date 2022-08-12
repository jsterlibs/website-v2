import breeze from "breezewind";
import { setup, tw } from "twind";
import * as twindColors from "twind/colors";
import { virtualSheet, getStyleTag } from "twind/sheets";
import twindTypography from "@twind/typography";
import * as breezeExtensions from "breezewind/extensions";
import * as components from "../../components.ts";
import component from "../../site/layouts/libraryPage.json" assert { type: "json" };
import sharedTwindSetup from "../../sharedTwindSetup.ts";
import { injectStyleTag } from "../../utils.ts";

const sheet = virtualSheet();

setup({ ...sharedTwindSetup({ twindColors, twindTypography }), sheet });

export async function onRequest({
  params: { id },
}: {
  params: { id: string };
}) {
  sheet.reset();

  // TODO: Pass proper context here
  const html = await breeze({
    component,
    components,
    context: {},
    extensions: [
      breezeExtensions.classShortcut(tw),
      breezeExtensions.foreach,
      breezeExtensions.visibleIf,
    ],
  });

  return new Response(injectStyleTag(html, getStyleTag(sheet)), {
    headers: { "content-type": "text/html" },
  });
}
