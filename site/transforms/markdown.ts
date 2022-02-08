import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";

function transformMarkdown(input: string) {
  return Marked.parse(input);
}

export default transformMarkdown;
