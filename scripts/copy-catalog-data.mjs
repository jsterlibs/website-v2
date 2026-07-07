import { cp, mkdir } from "node:fs/promises";

await mkdir("build/data", { recursive: true });
await cp("data/libraries", "build/data/libraries", {
  recursive: true,
  force: true,
});
