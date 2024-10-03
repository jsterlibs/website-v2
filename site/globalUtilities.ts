import { urlJoin } from "./utilities/urlJoin.ts";

function init() {
  function cleanUrl(s: string) {
    return s.trim().toLowerCase();
  }

  return { cleanUrl, urlJoin };
}

export { init };
