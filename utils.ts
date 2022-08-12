async function getLibraryData(name: string) {
  const response = await fetch(
    `https://socket.dev/api/npm/package-info/score?name=${name}&low_priority=1`
  );

  try {
    const responseJson = await response.json();
    const { score, metrics } = responseJson;
    const data = {
      score: {
        supplyChain: score.supplyChainRisk.score,
        quality: score.quality.score,
        maintenance: score.maintenance.score,
        vulnerability: score.vulnerability.score,
        license: score.license.score,
      },
      metrics,
    };

    return Promise.resolve(data);
  } catch (_error) {
    return Promise.reject("Internal error");
  }
}

// TODO: Consider exposing from gustwind
function injectStyleTag(markup: string, styleTag: string) {
  const parts = markup.split("</head>");

  return parts[0] + styleTag + parts[1];
}

export { getLibraryData, injectStyleTag };
