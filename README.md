[![vr scripts](https://badges.velociraptor.run/flat.svg)](https://velociraptor.run)

# JSter - Website v2

This repository contains the source for jster.net.

## Usage

Run the available commands through [velociraptor](https://github.com/umbopepato/velociraptor) (vr).

To generate a static build, use either `vr build` or `deno run --unstable --import-map=import_map.json -A ./scripts/build.ts`. Use `vr start` for development.

### Decompressing cache

Run the following:

```
CACHE_LOCATION=https://jster.pages.dev/cache.tar.gz deno task decompress:cache
```

After this you'll have `.gustwind_cache` if the cache was found at the url.
