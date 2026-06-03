import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const layouts = await loadFiles({
  path: "./site/layouts",
  extension: ".html",
});
const components = await loadFiles({
  path: "./site/components",
  extension: ".html",
});
const layoutUtilities = await loadFiles({
  path: "./site/layouts",
  extension: ".server.ts",
});
const componentUtilities = await loadFiles({
  path: "./site/components",
  extension: ".server.ts",
});

await writeFile("manifest.ts", generateCode());

function generateCode() {
  return `// IMPORTANT! This code has been generated, do not alter it directly
${componentUtilities
  .concat(layoutUtilities)
  .map(
    ([k, v]) =>
      `import * as ${k}Utilities from "./${v}";`,
  )
  .join("\n")}

${components
  .concat(layouts)
  .map(
    ([k, v]) => `import ${k} from "./${v}";`,
  )
  .join("\n")}

const componentUtilities = {
${componentUtilities
  .concat(layoutUtilities)
  .map(([k]) => `  ${k}: ${k}Utilities,`)
  .join("\n")}
};

const components = {
${components
  .concat(layouts)
  .map(([k]) => `  ${k},`)
  .join("\n")}
};

export { components, componentUtilities };`;
}

async function loadFiles({
  path,
  extension,
}) {
  const files = await dir({ path, extension });

  return Promise.all(
    files.map(async ({ name, path }) => [
      name.split(".")[0],
      path,
    ]),
  );
}

async function dir({ path, extension }) {
  const files = [];

  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push({
        name: entry.name,
        path: join(path, entry.name),
      });
    }
  }

  return files;
}
