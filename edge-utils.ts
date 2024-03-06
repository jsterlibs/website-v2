// Adapted and extracted from https://reego.dev/blog/achieving-isr-on-cloudflare-workers
async function isr(
  request: Request,
  kv: KVNamespace,
  waitUntil: (promise: Promise<any>) => void,
  headers: HeadersInit,
  getResponse: () => Promise<Response>
) {
  const url = new URL(request.url);

  // Replace the last slash with empty to normalize foo and foo/ into the same case
  // Remove leading slashes
  // Replace /'s with -'s to avoid
  // "FileStorageError [ERR_NAMESPACE_KEY_CHILD]: Cannot put key"
  const key = url.pathname
    .replace(/\/$/, "")
    .replace(/^\/+/, "")
    .replace(/\//g, "-");

  // Try to serve a static asset from KV
  try {
    const asset = await kv.get(key);
    if (asset) {
      return new Response(asset, { headers });
    }
  } catch (err) {
    // ignore errors and fall back to app rendering
  }

  // Fall back to app rendering
  try {
    // This part is framework-specific.
    // Your favourite framework will render the page
    // based on the request path
    const response = await getResponse();

    if (response) {
      // ISR is achieved here:
      // on successful renders we store the response in KV.
      // Subsequent requests will be served from the store
      if (response.status >= 200 && response.status < 300) {
        // Since response can be read only once, duplicate it
        const res = new Response(response.body);
        const markup = await res.text();

        waitUntil(kv.put(key, markup));

        return new Response(markup, { headers: response.headers });
      }

      return response;
    }
  } catch (error) {
    return new Response(
      // @ts-expect-error: TS is tricky with errors so keep this simple for now
      "Error rendering route: " + (error.message || error.toString()),
      {
        status: 500,
      }
    );
  }

  return new Response("Not found", {
    status: 404,
  });
}

export { isr };
