import * as Html5Entities from "../utilities/html5entities";
import { install, tw } from "@twind/core";
import { marked } from "marked";
import highlight from "highlight.js";
import highlightBash from "highlight.js/lib/languages/bash";
import highlightJS from "highlight.js/lib/languages/javascript";
import highlightJSON from "highlight.js/lib/languages/json";
import highlightTS from "highlight.js/lib/languages/typescript";
import highlightYAML from "highlight.js/lib/languages/yaml";
import twindSetup from "../twindSetup";

highlight.registerLanguage("bash", highlightBash);
highlight.registerLanguage("javascript", highlightJS);
highlight.registerLanguage("js", highlightJS);
highlight.registerLanguage("json", highlightJSON);
highlight.registerLanguage("typescript", highlightTS);
highlight.registerLanguage("ts", highlightTS);
highlight.registerLanguage("yaml", highlightYAML);

marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: true,
  highlight: (code: string, language: string) => {
    return highlight.highlight(code, { language }).value;
  },
});

install(twindSetup);

function getTransformMarkdown() {
  return function transformMarkdown(input: string) {
    // https://github.com/markedjs/marked/issues/545
    const tableOfContents: { slug: string; level: number; text: string }[] = [];

    // https://marked.js.org/using_pro#renderer
    // https://github.com/markedjs/marked/blob/master/src/Renderer.js
    marked.use({
      renderer: {
        code(code: string, infostring: string): string {
          const lang = ((infostring || "").match(/\S*/) || [])[0];

          // @ts-ignore How to type this?
          if (this.options.highlight) {
            if (!lang) {
              // TODO: Figure out what to do in this case
              console.error("Missing language for", code);

              return code;
            }

            // @ts-ignore How to type this?
            const out = this.options.highlight(code, lang);

            if (out != null && out !== code) {
              code = out;
            }
          }

          code = code.replace(/\n$/, "") + "\n";

          if (!lang) {
            return "<pre><code>" + code + "</code></pre>\n";
          }

          return (
            '<pre class="' +
            tw`overflow-auto -mx-4 md:mx-0 bg-gray-100` +
            '"><code class="' +
            // @ts-ignore How to type this?
            this.options.langPrefix +
            lang +
            '">' +
            code +
            "</code></pre>\n"
          );
        },
        heading(text: string, level: number, raw: string) {
          const slug = slugify(raw);

          tableOfContents.push({ slug, level, text });

          return (
            '<a href="#' +
            slug +
            '"><h' +
            level +
            ' class="' +
            tw`inline` +
            '"' +
            ' id="' +
            slug +
            '">' +
            text +
            "</h" +
            level +
            ">" +
            "</a>\n"
          );
        },
        image(href: string, title: string, text: string) {
          const textParts = text ? text.split("|") : [];
          const alt = textParts[0] || "";
          const width = textParts[1] || "";
          const height = textParts[2] || "";
          const className = textParts[3] || "";

          return `<img src="${href}" alt="${alt}" class="${tw(
            className
          )}" width="${width}" height="${height}" />`;
        },
        link(href: string, title: string, text: string) {
          if (href === null) {
            return text;
          }

          if (text === "<file>") {
            return this.code(Deno.readTextFileSync(href), href.split(".")[1]);
          }

          const parts = text.split("|");

          let out =
            '<a class="' +
            tw(["underline"].concat(parts[1])) +
            '" href="' +
            href +
            '"';
          if (title) {
            out += ' title="' + title + '"';
          }
          out += ">" + parts[0] + "</a>";
          return out;
        },
        list(body: string, ordered: string, start: number) {
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
            tw(klass) +
            '">\n' +
            body +
            "</" +
            type +
            ">\n"
          );
        },
      },
    });

    return { content: Html5Entities.decode(marked(input)), tableOfContents };
  };
}

function slugify(idBase: string) {
  return idBase
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w]+/g, "-");
}

export default getTransformMarkdown;
