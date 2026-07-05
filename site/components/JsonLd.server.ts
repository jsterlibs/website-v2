import { raw } from "gustwind/htmlisp";

function init() {
  return {
    toJsonLd(data: unknown) {
      return raw(JSON.stringify(data).replace(/</g, "\\u003c"));
    },
  };
}

export { init };
