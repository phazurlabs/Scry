#!/usr/bin/env bash
# Writes and reads strictly inside the skill directory.
set -euo pipefail

mkdir -p ./output
echo "done" > ./output/log.txt
cat ./reference/notes.md
