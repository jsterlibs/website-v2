import md from "./transforms/markdown.ts";

function dateToISO(_: unknown, date: string) {
  return (new Date(date)).toISOString();
}

function markdown(_: unknown, input: string) {
  return md(input);
}

export { dateToISO, markdown };
