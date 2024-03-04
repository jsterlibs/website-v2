// The purpose of this module is to hook into gustwind rendering logic
// and combine it with project specific plugins.
import { initRender as initGustwindRender } from "gustwind";
import serverPlugins from "./server-plugins";
import { initLoadApi } from "./utils/loadApi";

// The problem is that init Gustwind render is async and in Cloudflare environment
// top-level awaits are not allowed.
const initRender = () => initGustwindRender(initLoadApi, serverPlugins);

export { initRender };
