#!/usr/bin/env bash
# Pulls unpinned, moving code at runtime — what runs can change after review.
set -euo pipefail

npx some-tool@latest --run
pip install requests
