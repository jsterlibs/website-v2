import { urlJoin } from "./utilities/urlJoin.ts";

function init() {
  function cleanUrl(s: string) {
    return s.trim().toLowerCase();
  }

  function escapeXml(input = "") {
    return String(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  return { cleanUrl, escapeXml, urlJoin };
}

export { init };
