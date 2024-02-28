// TODO: Replace fs with something else
// import fs from "node:fs/promises";
// TODO: Replace dir() with a Node glob if possible
// import { dir } from "../utilities/fs.ts";

// TODO: Figure out why these are not found
import type { LoadApi, PluginParameters, Tasks } from "gustwind";

function initLoadApi(tasks: Tasks): LoadApi {
  return {
    dir({ path, extension, recursive, type }) {
      tasks.push({
        type: "listDirectory",
        payload: { path, type },
      });

      console.log("dir", path, extension, recursive, type);

      // TODO: Replace this with a Node version if possible
      // return dir({ path, extension, recursive });
      return Promise.resolve([]);
    },
    json<T>(payload: Parameters<PluginParameters["load"]["json"]>[0]) {
      tasks.push({ type: "loadJSON", payload });

      // TODO: Is it enough to support only local paths here?
      // https://examples.deno.land/importing-json
      return import(`file://${payload.path}?cache=${new Date().getTime()}`, {
        assert: { type: "json" },
      }).then((m) => m.default) as Promise<T>;
    },
    module<T>(payload: Parameters<PluginParameters["load"]["module"]>[0]) {
      tasks.push({ type: "loadModule", payload });

      // TODO: Is it enough to support only local paths here?
      return import(
        `file://${payload.path}?cache=${new Date().getTime()}`
      ) as Promise<T>;
    },
    textFile(path: string) {
      tasks.push({
        type: "readTextFile",
        payload: { path, type: "" },
      });

      return Promise.resolve("foobar");
      // return fs.readFile(path, { encoding: "utf-8" });
    },
    textFileSync(path: string) {
      tasks.push({
        type: "readTextFile",
        payload: { path, type: "" },
      });

      return "barfoo";
      // return fs.readFileSync(path, { encoding: "utf-8" });
    },
  };
}

export { initLoadApi };
