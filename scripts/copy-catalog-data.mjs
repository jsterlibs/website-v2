import { cp, mkdir } from "node:fs/promises";

await mkdir("build/data", { recursive: true });
await cp("data/blogposts.json", "build/data/blogposts.json", {
  force: true,
});
await cp("data/categories.json", "build/data/categories.json", {
  force: true,
});
await cp("data/categories", "build/data/categories", {
  recursive: true,
  force: true,
});
await cp("data/libraries", "build/data/libraries", {
  recursive: true,
  force: true,
});
await cp("data/tags", "build/data/tags", {
  recursive: true,
  force: true,
});
