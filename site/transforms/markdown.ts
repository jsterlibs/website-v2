import { marked } from "marked";
import type { Tokens } from "marked";
import highlight from "highlight.js";

import highlightBash from "highlight.js/lib/languages/bash";
import highlightJS from "highlight.js/lib/languages/javascript";
import highlightJSON from "highlight.js/lib/languages/json";
import highlightTS from "highlight.js/lib/languages/typescript";
import highlightYAML from "highlight.js/lib/languages/yaml";


highlight.registerLanguage("bash", highlightBash);
highlight.registerLanguage("javascript", highlightJS);
highlight.registerLanguage("js", highlightJS);
highlight.registerLanguage("json", highlightJSON);
highlight.registerLanguage("typescript", highlightTS);
highlight.registerLanguage("ts", highlightTS);
highlight.registerLanguage("yaml", highlightYAML);

const DEFAULT_CODE_LANGUAGE = "plaintext";

marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false,
});

function getTransformMarkdown(load?: { textFileSync(path: string): string }) {
  return function transformMarkdown(input: string) {
    input = normalizeInlineMarkdown(input);

    // https://github.com/markedjs/marked/issues/545
    const tableOfContents: { slug: string; level: number; text: string }[] = [];

    // https://marked.js.org/using_pro#renderer
    // https://github.com/markedjs/marked/blob/master/src/Renderer.js
    marked.use({
      renderer: {
        code(this: any, { text, lang: infostring }: Tokens.Code): string {
          let code = text;
          const lang =
            ((infostring || "").match(/\S*/) || [])[0] ||
            DEFAULT_CODE_LANGUAGE;

          const canHighlight = highlight.getLanguage(lang);

          if (canHighlight) {
            code = highlight.highlight(code, { language: lang }).value;
          }

          if (!canHighlight) {
            code = escapeHtml(code);
          }

          code = code.replace(/\n$/, "") + "\n";

          return (
            '<pre class="' +
            "overflow-auto -mx-4 md:mx-0 bg-gray-100" +
            '"><code class="' +
            // @ts-ignore How to type this?
            this.options.langPrefix +
            lang +
            '">' +
            code +
            "</code></pre>\n"
          );
        },
        heading(this: any, { tokens, depth, text: raw }: Tokens.Heading) {
          const text = this.parser.parseInline(tokens);
          const slug = slugify(raw);

          tableOfContents.push({ slug, level: depth, text });

          return (
            '<a href="#' +
            slug +
            '"><h' +
            depth +
            ' class="' +
            "inline" +
            '"' +
            ' id="' +
            slug +
            '">' +
            text +
            "</h" +
            depth +
            ">" +
            "</a>\n"
          );
        },
        image(this: any, { href, text, tokens }: Tokens.Image) {
          if (tokens) {
            text = this.parser.parseInline(tokens, this.parser.textRenderer);
          }

          const textParts = text ? text.split("|") : [];
          const alt = textParts[0] || "";
          const width = textParts[1] || "";
          const height = textParts[2] || "";
          const className = textParts[3] || "";

          return `<img src="${href}" alt="${alt}" class="${className}" width="${width}" height="${height}" />`;
        },
        link(this: any, { href, title, tokens }: Tokens.Link) {
          const text = this.parser.parseInline(tokens);

          if (href === null) {
            return text;
          }

          if (text === "<file>") {
            return this.code(load?.textFileSync(href) || "", href.split(".")[1]);
          }

          const parts = text.split("|");

          let out =
            '<a class="' +
            ["underline"].concat(parts[1]).filter(Boolean).join(" ") +
            '" href="' +
            href +
            '"';
          if (title) {
            out += ' title="' + title + '"';
          }
          out += ">" + escapeHtml(parts[0]) + "</a>";
          return out;
        },
        list(this: any, { items, ordered, start }: Tokens.List) {
          const body = items.map((item) => this.listitem(item)).join("");
          const type = ordered ? "ol" : "ul",
            startatt = ordered && start !== 1 ? ' start="' + start + '"' : "",
            klass = ordered
              ? "list-decimal list-inside"
              : "list-disc list-inside";
          return (
            "<" +
            type +
            startatt +
            ' class="' +
            klass +
            '">\n' +
            body +
            "</" +
            type +
            ">\n"
          );
        },
      },
    });

    return { content: marked(input), tableOfContents };
  };
}

function normalizeInlineMarkdown(input: string) {
  const lines = input.replace(/\r\n/g, "\n").split("\n");

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }

  while (lines.length && !lines.at(-1)?.trim()) {
    lines.pop();
  }

  const indent = Math.min(
    ...lines
      .filter((line) => line.trim())
      .map((line) => line.match(/^\s*/)?.[0].length || 0),
  );

  if (!Number.isFinite(indent) || indent === 0) {
    return lines.join("\n");
  }

  return lines.map((line) => line.slice(indent)).join("\n");
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slugify(idBase: string) {
  return idBase
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w]+/g, "-");
}

export default getTransformMarkdown;
