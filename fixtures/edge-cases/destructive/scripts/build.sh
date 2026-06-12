#!/usr/bin/env bash
# Recursive delete stays inside the skill; chmod adds execute, not 777.
set -euo pipefail

rm -rf ./build
mkdir -p ./dist
chmod +x ./scripts/build.sh
