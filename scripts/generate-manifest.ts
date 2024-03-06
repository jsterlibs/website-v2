import { dir } from "https://deno.land/x/gustwind@v0.64.0/utilities/fs.ts";

const layouts = await loadFiles({
  path: "./site/layouts",
  extension: ".html",
  includeExtension: true,
});
const components = await loadFiles({
  path: "./site/components",
  extension: ".html",
  includeExtension: true,
});
const layoutUtilities = await loadFiles({
  path: "./site/layouts",
  extension: ".server.ts",
});
const componentUtilities = await loadFiles({
  path: "./site/components",
  extension: ".server.ts",
});

await Deno.writeTextFile("manifest.ts", generateCode());

// TODO: dir() and generate components + componentUtilities
function generateCode() {
  return `// IMPORTANT! This code has been generated, do not alter it directly
${componentUtilities
  .concat(layoutUtilities)
  .map(
    ([k, v]) =>
      `import * as ${k}Utilities from "./${v
        .split(".")
        .slice(0, -1)
        .join(".")}";`
  )
  .join("\n")}

${components
  .concat(layouts)
  .map(
    ([k, v]) => `import ${k} from "./${v.split(".").slice(0, -1).join(".")}";`
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
  includeExtension,
}: {
  path: string;
  extension: string;
  includeExtension?: boolean;
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
      includeExtension ? path + extension : path,
    ])
  );
}
