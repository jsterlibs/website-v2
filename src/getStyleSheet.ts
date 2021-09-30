import { virtualSheet } from "twind-sheets";
import { setup } from "twind";
import * as colors from "twind-colors";
import typography from "twind-typography";

// https://twind.dev/handbook/the-shim.html#server
function getStyleSheet() {
  const sheet = virtualSheet();

  setup({ sheet, theme: { colors }, plugins: { ...typography() } });

  return sheet;
}

export { getStyleSheet };
