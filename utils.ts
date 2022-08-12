// TODO: Consider exposing from gustwind
function injectStyleTag(markup: string, styleTag: string) {
  const parts = markup.split("</head>");

  return parts[0] + styleTag + parts[1];
}

export { injectStyleTag };
