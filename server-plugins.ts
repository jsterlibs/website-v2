// TODO: Change export map
import { plugin as breezewindPlugin } from "gustwind/plugins/breezewind-renderer";
import { plugin as metaPlugin } from "gustwind/plugins/meta";
import { plugin as twindPlugin } from "gustwind/plugins/twind";
import * as globalUtilities from "./site/globalUtilities";
import twindSetup from "./site/twindSetup";
import meta from "./site/meta.json";
import { components, componentUtilities } from "./manifest";

export default [
  // TODO: Pass loaded components and globalUtilities to renderer
  // TODO: Likely this has to handle loading server.ts files related to each component as well
  breezewindPlugin.init({ components, componentUtilities, globalUtilities }),
  metaPlugin.init({ meta }),
  twindPlugin.init({ twindSetup }),
];
