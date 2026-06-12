#!/usr/bin/env bash
# Base64 ENCODE (no decode, no exec) and a single character code — both benign.
set -euo pipefail

base64 logo.png > logo.b64
