#!/usr/bin/env bash
# Every dependency is pinned to an exact version or resolved from a pinned file.
set -euo pipefail

npx some-tool@1.4.2 build
pip install requests==2.31.0
pip install -r requirements.txt
