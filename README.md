# JSter - Website v2

This repository contains the source for jster.net.

## Usage

See `npm run` for available build targets.

### Cloudflare build cache

Cloudflare uses the previously deployed site as Gustwind's cache source:

```
npm run build:cloudflare
```

That reads `https://jster.net/.gustwind/build-cache.json` and reuses route
outputs from the deployed site when their fingerprints still match.

### Testing CF

1. `npm run build && npm run copy:css && npm run generate:manifest`
2. `npm run workers:dev`
3. Head to `http://localhost:8787/library/jquery`

Note that the CF setup doesn't proxy static portion of the site automatically yet but that could likely be added (or the other way around).
