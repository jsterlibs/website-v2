function getJsonSync(filePath: string) {
  return JSON.parse(Deno.readTextFileSync(filePath));
}

function last<O>(array: O[]) {
  return array[array.length - 1];
}

// deno-lint-ignore no-explicit-any
const isObject = (a: any) => typeof a === "object";

export { getJsonSync, isObject, last };
