import breeze from "breezewind";
import { setup, tw } from "twind";
import * as twindColors from "twind/colors";
import { virtualSheet, getStyleTag } from "twind/sheets";
import twindTypography from "@twind/typography";
import * as breezeExtensions from "breezewind/extensions";
import * as components from "../../components.ts";
import component from "../../site/layouts/libraryPage.json" assert { type: "json" };
import getSharedTwindSetup from "../../sharedTwindSetup.ts";
import getUtilities from "../../sharedUtilities.ts";
import { getLibraryData, injectStyleTag } from "../../utils.ts";

const sheet = virtualSheet();

setup({ ...getSharedTwindSetup({ twindColors, twindTypography }), sheet });

export async function onRequest({
  params: { id },
}: {
  params: { id: string };
}) {
  sheet.reset();

  try {
    // TODO: Cache library data
    const libraryData = await getLibraryData(id);
    const html = await breeze({
      component,
      components,
      // TODO: Pass information from github here as well (readme + links)
      context: libraryData,
      extensions: [
        breezeExtensions.classShortcut(tw),
        breezeExtensions.foreach,
        breezeExtensions.visibleIf,
      ],
      // TODO: Pass proper markdown handler
      utilities: getUtilities((s: string) => ({
        content: s,
      })),
    });

    return new Response(injectStyleTag(html, getStyleTag(sheet)), {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  } catch (_error) {
    return new Response(`{ "error": "Internal error" }`, {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
