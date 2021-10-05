import { virtualSheet } from "https://unpkg.com/twind@0.16.16/sheets/sheets.js";
import { setup } from "https://unpkg.com/twind@0.16.16/twind.js";
import * as colors from "https://unpkg.com/twind@0.16.16/colors/colors.js";
import typography from "https://unpkg.com/@twind/typography@0.0.2/typography.js";

// https://twind.dev/handbook/the-shim.html#server
function getStyleSheet() {
  const sheet = virtualSheet();

  setup({
    sheet,
    theme: { colors },
    plugins: {
      // TODO: How to override blockquote styles?
      ...typography(),
    },
  });

  return sheet;
}

export { getStyleSheet };
