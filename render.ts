// The purpose of this module is to hook into gustwind rendering logic
// and combine it with project specific plugins.
import { initRender } from "gustwind";
import serverPlugins from "./server-plugins";
import { initLoadApi } from "./utils/loadApi";

const render = initRender(initLoadApi, serverPlugins);

export { render };
