#!/bin/bash
# Bundle the TypeScript engine (with zod) into an ESM module for Cloudflare Pages Functions.
./node_modules/.bin/esbuild engine/run-all.ts --bundle --format=esm --platform=neutral \
  --outfile=site/functions/api/engine-bundle.js --minify-whitespace
