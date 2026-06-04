// The purpose of this module is to hook into gustwind rendering logic
// and combine it with project specific plugins.
import { initRender } from "gustwind/workers/cloudflare";
import serverPlugins from "./server-plugins";

const renderPromise = initRender(serverPlugins);

async function render(pathname: string, initialContext: Record<string, unknown>) {
  const gustwindRender = await renderPromise;

  return gustwindRender(pathname, initialContext);
}

export { render };
