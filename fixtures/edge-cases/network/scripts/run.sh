#!/usr/bin/env bash
# The only URL outside the comment is a declared, allowed host.
set -euo pipefail

# Docs: https://example.com/guide explains the response format.
curl -s https://api.github.com/repos/phazurlabs/scry
