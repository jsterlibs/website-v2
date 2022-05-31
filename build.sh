#!/usr/bin/env bash

curl -fsSL https://deno.land/x/install/install.sh | sh -s v1.22.0
deno task decompress:cache
deno task build
