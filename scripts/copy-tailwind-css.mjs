import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const buildDirectory = "build";
const files = await readdir(buildDirectory);
const tailwindFile = files.find((file) => /^tailwind-[a-f0-9]+\.css$/.test(file));

if (!tailwindFile) {
  throw new Error("Failed to find generated Tailwind CSS file in build/");
}

await mkdir(join(buildDirectory, "assets"), { recursive: true });
await copyFile(join(buildDirectory, tailwindFile), join(buildDirectory, "assets", "site.css"));
