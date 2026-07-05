// Adapted and extracted from https://reego.dev/blog/achieving-isr-on-cloudflare-workers
async function isr(
  request: Request,
  kv: KVNamespace,
  waitUntil: (promise: Promise<any>) => void,
  headers: HeadersInit,
  expirationTtl: number, // Given in seconds
  getResponse: () => Promise<Response>
) {
  const url = new URL(request.url);

  if (isLocalDevUrl(url)) {
    try {
      const response = await getResponse();

      if (response) {
        return withLocalDevHeaders(response);
      }
    } catch (error) {
      return renderErrorResponse(error);
    }

    return new Response("Not found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-ISR-Cache": "bypass",
      },
    });
  }

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

        // https://developers.cloudflare.com/kv/api/write-key-value-pairs/#create-expiring-keys
        waitUntil(kv.put(key, markup, { expirationTtl }));

        return new Response(markup, { headers: response.headers });
      }

      return response;
    }
  } catch (error) {
    return renderErrorResponse(error);
  }

  return new Response("Not found", {
    status: 404,
  });
}

function isLocalDevUrl(url: URL) {
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

function withLocalDevHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-ISR-Cache", "bypass");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function renderErrorResponse(error: unknown) {
  return new Response(
    "Error rendering route: " + getErrorMessage(error),
    {
      status: 500,
    },
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export { isr };
