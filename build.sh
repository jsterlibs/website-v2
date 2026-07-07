#!/usr/bin/env bash
set -euo pipefail

cache_root="${npm_config_cache:-$HOME/.npm}/jster-gustwind"
cache_archive="$cache_root/build.tar"

if [ -f "$cache_archive" ]; then
  echo "Restoring Gustwind build cache from $cache_archive"
  rm -rf build
  tar -xf "$cache_archive"
  npm run build
else
  echo "No local Gustwind build cache found; falling back to published cache"
  npm run build:cloudflare
fi

npm run generate:manifest

mkdir -p "$cache_root"
tar -cf "$cache_archive" build
