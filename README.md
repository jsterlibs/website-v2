# JSter - Website v2

This repository contains the source for jster.net.

## Usage

See `npm run` for available build targets.

### Decompressing cache

Run the following:

```
CACHE_LOCATION=https://jster.pages.dev/cache.tar.gz npm run decompress:cache
```

After this you'll have `.gustwind` if the cache was found at the url.

### Testing CF

1. `npm run build && npm run copy:css && npm run generate:manifest`
2. `npm run pages:dev`
3. Head to `http://localhost:8788/library/jquery`

Note that the CF setup doesn't proxy static portion of the site automatically yet but that could likely be added (or the other way around).
