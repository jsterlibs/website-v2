import type { Routes } from "https://deno.land/x/gustwind@v0.52.3/types.ts";

function init({ routes }: { routes: Routes }) {
  function validateUrl(url: string) {
    if (!url) {
      return;
    }

    const [urlRoot, anchor] = url.split("#");

    if (Object.keys(routes).includes(urlRoot)) {
      return urlRoot === "/"
        ? url
        : `/${urlRoot}${anchor ? "#" + anchor : "/"}`;
    }

    // Check against /atom.xml and similar
    if (urlRoot[0] === "/" && Object.keys(routes).includes(urlRoot.slice(1))) {
      return url;
    }

    // TODO: This would be a good spot to check the url doesn't 404
    // To keep this fast, some kind of local, time-based cache would
    // be good to have to avoid hitting the urls all the time.
    if (url.startsWith("http")) {
      return url;
    }

    // TODO: Change the validation so that on the edge it's reading static routes
    // TODO: This means there should be access to env here (pass through a parameter)
    // and likely static, expanded routes should be available here as well
    // TODO: An easy option would be to skip validation only on edge and keep it in the static environment
    return url;

    /*
    throw new Error(
      `Failed to find matching url for "${url}" from ${Object.keys(routes).join(
        ", "
      )}`
    );
    */
  }

  return { validateUrl };
}

export { init };
