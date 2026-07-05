import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const buildDirectory = "build";
const files = await readdir(buildDirectory);
const tailwindFiles = files.filter((file) => /^tailwind-[a-f0-9]+\.css$/.test(file));

if (!tailwindFiles.length) {
  throw new Error("Failed to find generated Tailwind CSS file in build/");
}

const tailwindFileStats = await Promise.all(
  tailwindFiles.map(async (file) => ({
    file,
    mtimeMs: (await stat(join(buildDirectory, file))).mtimeMs,
  })),
);
const [tailwindFile] = tailwindFileStats.sort((a, b) => b.mtimeMs - a.mtimeMs);

await mkdir(join(buildDirectory, "assets"), { recursive: true });
await copyFile(join(buildDirectory, tailwindFile.file), join(buildDirectory, "assets", "site.css"));
