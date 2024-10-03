import { urlJoin } from "./utilities/urlJoin.ts";

function init() {
  function clearUrl(s: string) {
    return s.trim().toLowerCase();
  }

  return { clearUrl, urlJoin };
}

export { init };
