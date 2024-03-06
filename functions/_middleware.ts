import { isr } from "../edge-utils.ts";
import { type Env } from "../types.ts";

const ONE_HOUR = 60 * 60;
const ONE_DAY = ONE_HOUR * 24;

const abTest = async (context: EventContext<Env, "", {}>) => {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith("/library/")) {
    return isr(
      context.request,
      context.env.PAGE_CACHE,
      context.waitUntil,
      {
        "Content-Type": "text/html;charset=UTF-8",
        // Cache results at the browser for one day
        "Cache-Control": `max-age=${ONE_DAY}`,
      },
      context.next
    );
  }
  return context.next();
};

export const onRequest = [abTest];
