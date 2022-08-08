import breeze from "breezewind";
import { setup, tw } from "twind";
import * as twindColors from "twind/colors";
import { virtualSheet, getStyleTag } from "twind/sheets";
import typography from "@twind/typography";
import * as breezeExtensions from "breezewind/extensions";
import * as components from "../components";
import component from "../site/layouts/libraryPage.json";

const sheet = virtualSheet();

setup({
  theme: { extend: { colors: twindColors } },
  plugins: {
    ...typography({
      className: "my-prose", // Defaults to 'prose'
    }),
  },
  sheet,
});

export async function onRequest() {
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

// TODO: Move to some utils
function injectStyleTag(markup: string, styleTag: string) {
  const parts = markup.split("</head>");

  return parts[0] + styleTag + parts[1];
}
