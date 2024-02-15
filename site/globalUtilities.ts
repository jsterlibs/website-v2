import { urlJoin } from "https://bundle.deno.dev/https://deno.land/x/url_join@1.0.0/mod.ts";
import md from "./transforms/markdown.ts";

function init() {
  function dateToISO(_: unknown, date: string) {
    return (new Date(date)).toISOString();
  }

  function markdown(_: unknown, input: string) {
    return md(input);
  }

  return { dateToISO, markdown, urlJoin };
}

export { init };
