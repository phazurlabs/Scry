#!/usr/bin/env bash
# Mentions .env in a comment and uses an ssh-ish variable name — neither is a
# real secret access.
set -euo pipefail

# load configuration from .env if present
ssh_config_path="./config/ssh_settings"
echo "$ssh_config_path"
