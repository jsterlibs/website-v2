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
