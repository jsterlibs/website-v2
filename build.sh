#!/usr/bin/env bash

curl -fsSL https://deno.land/x/install/install.sh | sh -s v1.22.0
/opt/buildhome/.deno/bin/deno task decompress:cache
/opt/buildhome/.deno/bin/deno task build
