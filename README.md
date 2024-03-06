# JSter - Website v2

This repository contains the source for jster.net.

## Usage

See `deno task` for available build targets.

### Decompressing cache

Run the following:

```
CACHE_LOCATION=https://jster.pages.dev/cache.tar.gz deno task decompress:cache
```

After this you'll have `.gustwind_cache` if the cache was found at the url.

### Testing CF

1. `npm start`
2. Head to `http://localhost:8788/library/jquery`

Note that the CF setup doesn't proxy static portion of the site automatically yet but that could likely be added (or the other way around).
