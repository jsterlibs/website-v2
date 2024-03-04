// The purpose of this module is to hook into gustwind rendering logic
// and combine it with project specific plugins.
import { initRenderComponent } from "gustwind";
import serverPlugins from "./server-plugins";
import { initLoadApi } from "./utils/loadApi";

const render = initRenderComponent(initLoadApi, serverPlugins);

export { render };
