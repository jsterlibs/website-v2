import type { LoadApi, PluginParameters, Tasks } from "gustwind";

function initLoadApi(tasks: Tasks): LoadApi {
  return {
    dir({ path, extension, recursive, type }) {
      tasks.push({
        type: "listDirectory",
        payload: { path, type },
      });

      return Promise.resolve([]);
    },
    json<T>(payload: Parameters<PluginParameters["load"]["json"]>[0]) {
      tasks.push({ type: "loadJSON", payload });

      return Promise.reject(
        new Error(`JSON loading is not available in the edge runtime: ${payload.path}`),
      );
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

      return Promise.reject(
        new Error(`Text file loading is not available in the edge runtime: ${path}`),
      );
    },
    textFileSync(path: string) {
      tasks.push({
        type: "readTextFile",
        payload: { path, type: "" },
      });

      throw new Error(`Text file loading is not available in the edge runtime: ${path}`);
    },
  };
}

export { initLoadApi };
