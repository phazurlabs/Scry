# Security Policy

Scry is a security tool. We take vulnerabilities in it seriously — a flaw in a
scanner or its gate can give a false sense of safety, which is worse than no tool
at all.

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue for a
vulnerability.

- Use GitHub's [private vulnerability reporting](https://github.com/phazurlabs/scry/security/advisories/new)
  for this repository, or
- email **security@phazurlabs.com** with the details.

Include, where possible:

- a description of the issue and its impact,
- a minimal reproduction (a fixture skill that demonstrates it is ideal),
- the Scry version (`npx @phazur/scry --version`) and your Node version.

We aim to acknowledge a report within 3 business days and to agree on a
disclosure timeline with you. We will credit reporters who want credit.

## What is in scope

- **Gate bypass** — a malicious skill that should be blocked by a critical rule
  but is allowed through the PreToolUse hook.
- **Scanner crashes that fail closed** — Scry is designed to fail _open_ on its
  own infrastructure errors; a path that instead bricks a user's workflow is a
  bug we want to know about.
- **False negatives in a critical rule** — a realistic malicious pattern within a
  documented threat class that a `critical` rule misses.
- **Settings/lock tampering** — any way the installer corrupts or fails to
  cleanly remove its `settings.json` block.

## What is not a vulnerability

- A skill doing something genuinely novel that static, deterministic analysis
  cannot detect. Scry is a seatbelt, not a guarantee (see the README
  Limitations). New attack shapes are feature requests for new rules, not
  security holes — though we still want to hear about them.
- An `info`/`warn` rule missing something. Those are advisory by design.

## Supported versions

Scry follows semantic versioning. Security fixes land on the latest minor
release. Pin a version in CI and update deliberately.
