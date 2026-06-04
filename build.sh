#!/usr/bin/env bash

npm run decompress:cache
npm run build
npm run copy:css
npm run generate:manifest
