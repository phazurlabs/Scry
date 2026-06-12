#!/usr/bin/env bash
# Commit already-staged changes with a provided message. No network, no deletes.
set -euo pipefail

msg="$1"
git add -A
git commit -m "$msg"
echo "Committed: $msg"
