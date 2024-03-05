#!/usr/bin/env bash

curl -fsSL https://deno.land/x/install/install.sh | sh -s v1.40.5
/opt/buildhome/.deno/bin/deno task decompress:cache
/opt/buildhome/.deno/bin/deno task build
/opt/buildhome/.deno/bin/deno task generate:manifest
