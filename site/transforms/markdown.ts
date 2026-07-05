import {
  defineHastPlugin,
  defineMdastPlugin,
  markdownToHtml,
} from "satteri";
import type { MarkdownToHtmlResult } from "satteri";
import type { Code, Heading, Image, Link, Paragraph } from "mdast";
import type { Element, RootContent } from "hast";
import type { LoadApi } from "gustwind";
import highlight from "highlight.js/lib/core";
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
const CODE_LANGUAGE_PREFIX = "language-";

type TableOfContentsEntry = { slug: string; level: number; text: string };
type HeadingAnchor = TableOfContentsEntry;

function getTransformMarkdown(load?: Pick<LoadApi, "textFileSync">) {
  return function transformMarkdown(input: string) {
    input = normalizeInlineMarkdown(input);

    const tableOfContents: TableOfContentsEntry[] = [];
    const headingAnchors = tableOfContents;
    const data = { hasCodeBlocks: false, tableOfContents };
    const result = markdownToHtml(input, {
      data,
      features: {
        gfm: true,
        frontmatter: false,
      },
      mdastPlugins: [createJsterMdastPlugin({ headingAnchors, load })],
      hastPlugins: [createJsterHastPlugin({ headingAnchors })],
    }) as MarkdownToHtmlResult;

    return { content: result.html, hasCodeBlocks: data.hasCodeBlocks, tableOfContents };
  };
}

function createJsterMdastPlugin(
  { headingAnchors, load }: {
    headingAnchors: HeadingAnchor[];
    load?: Pick<LoadApi, "textFileSync">;
  },
) {
  return defineMdastPlugin({
    name: "jster-markdown-mdast",
    code(node: Readonly<Code>, ctx) {
      ctx.data.hasCodeBlocks = true;
      ctx.replaceNode(node, {
        rawHtml: renderCodeBlock({
          code: node.value,
          lang: node.lang || DEFAULT_CODE_LANGUAGE,
        }),
      });
    },
    heading(node: Readonly<Heading>, ctx) {
      const text = ctx.textContent(node);

      headingAnchors.push({
        slug: slugify(text),
        level: node.depth,
        text,
      });
    },
    paragraph(node: Readonly<Paragraph>, ctx) {
      if (node.children.length !== 1) {
        return;
      }

      const [child] = node.children;

      if (!isLinkNode(child) || ctx.textContent(child) !== "<file>") {
        return;
      }

      ctx.data.hasCodeBlocks = true;
      ctx.replaceNode(node, {
        rawHtml: renderCodeBlock({
          code: load?.textFileSync(child.url) || "",
          lang: child.url.split(".")[1],
        }),
      });
    },
    image(node: Readonly<Image>, ctx) {
      const textParts = node.alt ? node.alt.split("|") : [];
      const alt = textParts[0] || "";
      const width = textParts[1] || "";
      const height = textParts[2] || "";
      const className = textParts[3] || "";

      ctx.replaceNode(node, {
        rawHtml:
          `<img src="${escapeAttribute(node.url)}" alt="${escapeAttribute(alt)}" class="${escapeAttribute(className)}" width="${escapeAttribute(width)}" height="${escapeAttribute(height)}" />`,
      });
    },
  });
}

function createJsterHastPlugin(
  { headingAnchors }: { headingAnchors: HeadingAnchor[] },
) {
  let headingIndex = 0;

  return defineHastPlugin({
    name: "jster-markdown-hast",
    element: [
      {
        filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
        visit(node: Readonly<Element>, ctx) {
          const anchor = headingAnchors[headingIndex++];
          const slug = anchor?.slug ?? slugify(ctx.textContent(node));

          ctx.replaceNode(node, {
            type: "element",
            tagName: "a",
            properties: { href: `#${slug}` },
            children: [{
              type: "element",
              tagName: node.tagName,
              properties: {
                ...node.properties,
                class: "inline",
                id: slug,
              },
              children: node.children,
            }],
          });
        },
      },
      {
        filter: ["a"],
        visit(node: Readonly<Element>, ctx) {
          const text = ctx.textContent(node);
          const parts = text.split("|");
          const className = ["underline"].concat(parts[1]).filter(Boolean).join(
            " ",
          );
          const replacement: Element = {
            type: "element",
            tagName: "a",
            properties: {
              ...node.properties,
              class: className,
            },
            children: node.children,
          };

          if (parts.length > 1) {
            replacement.children = [{ type: "text", value: parts[0] }];
          }

          ctx.replaceNode(node, replacement);
        },
      },
      {
        filter: ["ul"],
        visit(node: Readonly<Element>, ctx) {
          ctx.setProperty(node, "class", "list-disc list-inside");
        },
      },
      {
        filter: ["ol"],
        visit(node: Readonly<Element>, ctx) {
          ctx.setProperty(node, "class", "list-decimal list-inside");
        },
      },
      {
        filter: ["pre"],
        visit(node: Readonly<Element>, ctx) {
          const code = node.children.find(isCodeElement);

          if (!code) {
            return;
          }

          ctx.replaceNode(node, renderCodeElement({
            code: ctx.textContent(code),
            lang: getCodeLanguage(code),
          }));
        },
      },
    ],
  });
}

function isCodeElement(node: RootContent): node is Element {
  return node.type === "element" && node.tagName === "code";
}

function isLinkNode(node: Paragraph["children"][number]): node is Link {
  return node.type === "link";
}

function getCodeLanguage(code: Readonly<Element>) {
  const className = code.properties?.className ?? code.properties?.class;
  const classes = Array.isArray(className) ? className : [className];
  const languageClass = classes.find((value): value is string =>
    typeof value === "string" && value.startsWith(CODE_LANGUAGE_PREFIX)
  );

  return languageClass?.slice(CODE_LANGUAGE_PREFIX.length);
}

function renderCodeElement(
  { code, lang }: {
    code: string;
    lang?: string;
  },
): Element {
  const normalizedLang = normalizeCodeLanguage(lang);

  return {
    type: "element",
    tagName: "pre",
    properties: { class: "overflow-auto -mx-4 md:mx-0 bg-gray-100" },
    children: [{
      type: "element",
      tagName: "code",
      properties: { class: CODE_LANGUAGE_PREFIX + normalizedLang },
      children: [{
        type: "raw",
        value: highlightCode({ code, lang: normalizedLang }),
      }],
    }],
  };
}

function renderCodeBlock(
  { code, lang }: {
    code: string;
    lang?: string;
  },
) {
  const normalizedLang = normalizeCodeLanguage(lang);

  return '<pre class="overflow-auto -mx-4 md:mx-0 bg-gray-100"><code class="' +
    CODE_LANGUAGE_PREFIX +
    normalizedLang +
    '">' +
    highlightCode({ code, lang: normalizedLang }) +
    "</code></pre>\n";
}

function normalizeCodeLanguage(lang?: string) {
  return lang || DEFAULT_CODE_LANGUAGE;
}

function highlightCode(
  { code, lang }: { code: string; lang: string },
) {
  const renderedCode = highlight.getLanguage(lang)
    ? highlight.highlight(code, { language: lang }).value
    : escapeHtml(code);

  return renderedCode.replace(/\n$/, "") + "\n";
}

function normalizeInlineMarkdown(input: string) {
  const lines = input.replace(/\r\n/g, "\n").split("\n");

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }

  while (lines.length && !lines[lines.length - 1]?.trim()) {
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

function escapeAttribute(input: string) {
  return escapeHtml(input).replace(/"/g, "&quot;");
}

function slugify(idBase: string) {
  return idBase
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w]+/g, "-");
}

export default getTransformMarkdown;
