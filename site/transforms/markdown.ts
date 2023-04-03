import { marked } from "https://unpkg.com/marked@4.0.0/lib/marked.esm.js";

function transformMarkdown(input: string) {
  return marked(input);
}

export default transformMarkdown;
