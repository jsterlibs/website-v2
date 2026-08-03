#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import YAML from "yaml";

const ROOT = process.cwd();
const BLOGPOSTS_DIR = join(ROOT, "data/blogposts");
const ENV_PATH = join(ROOT, ".env");
const API_URL = "https://api.buttondown.com/v1";

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const env = { ...readEnv(ENV_PATH), ...process.env };
  const postPath = resolvePostPath(args.post);
  const post = parsePost(readFileSync(postPath, "utf8"), postPath);
  const siteUrl = (env.JSTER_SITE_URL || "https://jster.net").replace(/\/$/, "");
  const payload = {
    subject: post.title,
    slug: post.slug,
    canonical_url: `${siteUrl}/blog/${post.slug}`,
    body: `<!-- buttondown-editor-mode: plaintext -->\n\n${absolutizeLinks(post.body, siteUrl)}`,
    status: "draft",
  };

  if (args.dryRun) {
    console.log(JSON.stringify({ post: relative(postPath), action: action(args), payload }, null, 2));
    return;
  }

  const token = env.BUTTONDOWN_API_KEY;

  if (!token) {
    throw new Error("Missing BUTTONDOWN_API_KEY in .env");
  }

  const headers = {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  };
  const newsletterId = args.newsletter || env.BUTTONDOWN_NEWSLETTER_ID;

  if (newsletterId) {
    headers["Buttondown-Context"] = newsletterId;
  }

  const email = await request("/emails", {
    method: "POST",
    headers,
    body: payload,
  });

  if (args.send || args.schedule) {
    if (!email.id) {
      throw new Error("Buttondown created the draft without returning an email id");
    }

    await request(`/emails/${encodeURIComponent(email.id)}/publish`, {
      method: "POST",
      headers,
      body: args.schedule ? { publish_date: args.schedule } : {},
    });
  }

  console.log(`${action(args)} Buttondown email ${email.id}`);
  console.log(`Source: ${relative(postPath)}`);

  if (email.absolute_url) {
    console.log(`URL: ${email.absolute_url}`);
  }
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--post") {
      args.post = requireValue(argv[++index], "--post");
    } else if (arg === "--newsletter") {
      args.newsletter = requireValue(argv[++index], "--newsletter");
    } else if (arg === "--schedule") {
      args.schedule = parseDate(requireValue(argv[++index], "--schedule"));
    } else if (arg === "--send") {
      args.send = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.send && args.schedule) {
    throw new Error("Use either --send or --schedule, not both");
  }

  return args;
}

function requireValue(value, option) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }

  return value;
}

function parseDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid --schedule date: ${value}`);
  }

  if (date <= new Date()) {
    throw new Error(`--schedule must be in the future: ${value}`);
  }

  return date.toISOString();
}

function resolvePostPath(input) {
  if (input) {
    const directPath = isAbsolute(input) ? input : resolve(ROOT, input);

    if (existsSync(directPath)) {
      return directPath;
    }

    const number = input.match(/^(?:jster-)?(\d+)$/i)?.[1];

    if (number) {
      const match = getJsterPosts().find((file) =>
        new RegExp(`-jster-${number}\\.(?:md|yml)$`).test(file),
      );

      if (match) {
        return join(BLOGPOSTS_DIR, match);
      }
    }

    throw new Error(`Could not find JSter post: ${input}`);
  }

  const latest = getJsterPosts().at(-1);

  if (!latest) {
    throw new Error(`No JSter posts found in ${relative(BLOGPOSTS_DIR)}`);
  }

  return join(BLOGPOSTS_DIR, latest);
}

function getJsterPosts() {
  return readdirSync(BLOGPOSTS_DIR)
    .filter((file) => /^\d+-jster-\d+\.(?:md|yml)$/.test(file))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
}

function parsePost(content, postPath) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  let metadata;
  let body;

  if (frontmatter) {
    metadata = YAML.parse(frontmatter[1]);
    body = content.slice(frontmatter[0].length).trim();
  } else {
    metadata = YAML.parse(content);
    body = String(metadata.body || "").trim();
  }

  if (!metadata?.title || !metadata?.slug || !body) {
    throw new Error(`Post must have a title, slug, and body: ${relative(postPath)}`);
  }

  return { title: metadata.title, slug: metadata.slug, body };
}

function absolutizeLinks(body, siteUrl) {
  return body.replace(/\]\(\/(?!\/)/g, `](${siteUrl}/`);
}

function readEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);

      if (match) {
        env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }

      return env;
    }, {});
}

async function request(path, { method, headers, body }) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? parseResponse(text) : {};

  if (!response.ok) {
    const detail = data.detail || data.error || data.message || text || response.statusText;
    throw new Error(`Buttondown API ${response.status}: ${detail}`);
  }

  return data;
}

function parseResponse(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text };
  }
}

function action(args) {
  if (args.schedule) {
    return `Scheduled for ${args.schedule}:`;
  }

  return args.send ? "Published" : "Created draft";
}

function relative(filePath) {
  return filePath.startsWith(`${ROOT}/`) ? filePath.slice(ROOT.length + 1) : basename(filePath);
}

function printHelp() {
  console.log(
    [
      "Usage: npm run publish:buttondown -- [options]",
      "",
      "Create a Buttondown draft from the latest JSter post.",
      "",
      "Options:",
      "  --post <path|number>     Select a post; defaults to the latest JSter issue",
      "  --newsletter <uuid>     Override BUTTONDOWN_NEWSLETTER_ID",
      "  --send                   Publish and send immediately",
      "  --schedule <date>        Schedule publication using an ISO date",
      "  --dry-run                Print the Buttondown payload without calling the API",
      "  -h, --help               Show this help",
    ].join("\n"),
  );
}
