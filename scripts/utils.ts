import { readdir, readFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function getJson<R>(filePath: string): Promise<R> {
  return readFile(filePath, "utf8").then((d) => JSON.parse(d));
}

function getJsonSync<R>(filePath: string): R {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function last<O>(array: O[]) {
  return array[array.length - 1];
}

const isObject = (a: any) => typeof a === "object";

function get<O = Record<string, unknown>>(dataContext: O, key: string): string {
  let value = dataContext;

  // TODO: What if the lookup fails?
  key.split(".").forEach((k) => {
    if (isObject(value)) {
      // TODO: How to type
      // @ts-ignore Recursive until it finds the root
      value = value[k];
    }
  });

  // TODO: How to type
  return value as unknown as string;
}

async function dir(p: string) {
  const ret = [];

  for (const { name } of await readdir(p, { withFileTypes: true })) {
    ret.push({ path: join(p, name), name });
  }

  return ret;
}

function dirSync(p: string) {
  const ret = [];

  for (const { name } of readdirSync(p, { withFileTypes: true })) {
    ret.push({ path: join(p, name), name });
  }

  return ret;
}

function zipToObject<R>(arr: [string, R][]) {
  const ret: Record<string, R> = {};

  arr.forEach(([k, v]) => {
    ret[k] = v;
  });

  return ret;
}

export { dir, dirSync, get, getJson, getJsonSync, isObject, last, zipToObject };
