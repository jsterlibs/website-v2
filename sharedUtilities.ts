function utilities(md: (input: string) => { content: string }) {
  function dateToISO(_: unknown, date: string) {
    return new Date(date).toISOString();
  }

  function markdown(_: unknown, input: string) {
    return md(input).content;
  }

  function toFixed(_: unknown, input: number, amount: number) {
    return input.toFixed(amount);
  }

  return { dateToISO, markdown, toFixed };
}

export default utilities;
