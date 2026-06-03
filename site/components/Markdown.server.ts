import { raw } from "gustwind/htmlisp";
import getMarkdown from "../transforms/markdown.ts";
import type { LoadApi } from "gustwind";

function init({ load }: { load: LoadApi }) {
  const markdown = getMarkdown(load);

  return {
    processMarkdown: async (input: string) => raw((await markdown(input)).content),
  };
}

export { init };
