# JSter - Website v2

This repository contains the source for jster.net.

## Usage

See `npm run` for available build targets.

### Publishing to Buttondown

Create a Buttondown API key with write access to emails and add it to `.env`
(or export it in your shell):

```sh
BUTTONDOWN_API_KEY=...
```

The latest JSter issue is selected automatically. The command creates a draft
unless sending or scheduling is explicitly requested:

```sh
npm run publish:buttondown -- --dry-run
npm run publish:buttondown
npm run publish:buttondown -- --post 258
npm run publish:buttondown -- --send
npm run publish:buttondown -- --schedule 2026-08-04T09:00:00Z
```

For a platform account with multiple newsletters, also set
`BUTTONDOWN_NEWSLETTER_ID` to the target newsletter UUID. Immediate or scheduled
publishing requires sending permission on the API key.

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

The Worker serves static assets from `./build` and dynamic catalog routes from
`worker.ts`.

### Checking the 404 page

Run `npm run build:validate`, start `npm run workers:dev`, then run
`npm run check:404` in another terminal. Set `JSTER_TEST_URL` to test a local
Worker running on a different port. The checks cover static and dynamic missing
pages, HEAD and Markdown responses, JSON API errors, and existing routes.

The error page uses the shared Gustwind layout and is built as `build/404.html`.
Cloudflare serves it for missing static assets; the Worker also uses it for
missing libraries and tags. It returns HTTP 404 and stays out of the sitemap.
