[![vr scripts](https://badges.velociraptor.run/flat.svg)](https://velociraptor.run)

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

### Wrangler

To run the `./functions`, use `wrangler pages dev .`.
