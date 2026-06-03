import { spawn } from "node:child_process";

const cacheLocation = process.env.CACHE_LOCATION;

if (!cacheLocation) {
  process.exit(0);
}

const wget = spawn("wget", ["-c", cacheLocation, "-O", "-"], {
  stdio: ["ignore", "pipe", "inherit"],
});
const tar = spawn("tar", ["-xz"], {
  stdio: ["pipe", "inherit", "inherit"],
});

wget.stdout.pipe(tar.stdin);

const waitForExit = (child) =>
  new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${child.spawnfile} exited with code ${code}`));
    });
  });

try {
  await Promise.all([waitForExit(wget), waitForExit(tar)]);
} catch (error) {
  console.error(error);
  process.exit(1);
}
