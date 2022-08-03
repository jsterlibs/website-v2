const fs = require("fs").promises;
const path = require("path");

async function generateComponents() {
  const components = await fs.readdir("./site/components");
  let code = "";

  for (const name of components) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);

    code += `export { default as ${base} } from './site/components/${base}.json';\n`;
  }

  console.log(code);
}

generateComponents();
