import { dir } from "https://deno.land/x/gustwind@v0.64.0/utilities/fs.ts";

const layouts = await loadFiles({
  path: "./site/layouts",
  extension: ".html",
  readFile: true,
});
const components = await loadFiles({
  path: "./site/components",
  extension: ".html",
  readFile: true,
});
const layoutUtilities = await loadFiles({
  path: "./site/layouts",
  extension: ".server.ts",
  readFile: false,
});
const componentUtilities = await loadFiles({
  path: "./site/components",
  extension: ".server.ts",
  readFile: false,
});

await Deno.writeTextFile("manifest.ts", generateCode());

// TODO: dir() and generate components + componentUtilities
function generateCode() {
  return `// IMPORTANT! This code has been generated, do not alter it directly
${componentUtilities
  .concat(layoutUtilities)
  .map(
    ([k, v]) =>
      `import * as ${k} from "./${v.split(".").slice(0, -1).join(".")}";`
  )
  .join("\n")}

const componentUtilities = {
${componentUtilities
  .concat(layoutUtilities)
  .map(([k]) => `  ${k},`)
  .join("\n")}
};

const components = {
  ${components
    .concat(layouts)
    .map(([k, v]) => `"${k}": \`${v}\``)
    .join(",\n")}
};

export { components, componentUtilities };`;
}

async function loadFiles({
  path,
  extension,
  readFile,
}: {
  path: string;
  extension: string;
  readFile: boolean;
}) {
  // TODO: Inference doesn't work because the script is not in Deno env
  const files: { name: string; path: string }[] = await dir({
    path,
    extension,
    recursive: false,
  });

  return Promise.all(
    files.map(async ({ name, path }) => [
      name.split(".")[0],
      readFile ? await Deno.readTextFile(path) : path,
    ])
  );
}
