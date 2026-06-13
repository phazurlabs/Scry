---
name: scry
description: Use whenever the user installs, evaluates, inspects, downloads, or runs a third-party Claude Code skill, or asks whether a skill is safe or trustworthy. Runs the deterministic Scry scanner to surface supply-chain and injection risks before the skill executes, and narrates the resulting Discernment Report. Trigger on phrases like "install this skill", "is this skill safe", "add a skill", "run this skill", "review this skill".
---

# Scry — the discernment gate for skills

Skills execute. They don't think. Your job is to make sure the user has _scried_
a third-party skill — seen what's concealed inside it — before trusting it.

This skill narrates a **deterministic** scanner. You do not judge skills yourself
or invent severities. You run `scry` and report exactly what it found.

## When this triggers

Any time the user installs, evaluates, downloads, or is about to run a
third-party skill, or asks if a skill is safe.

## What to do

1. **Audit before use.** Run the scanner on the skill before it is invoked:

   ```
   npx @phazur/scry audit <path-to-skill>
   ```

   For a machine-readable report add `--json`; for a shareable one add `--md`.

2. **Report the verdict in three lines.** When you produce output that used a
   third-party skill, append a short Discernment verdict:

   - **Gates:** which severities passed/failed (e.g. "1 critical, 0 warn").
   - **Flags:** the rule ids that fired and the file:line each points to.
   - **Verify:** the one or two things the user should confirm themselves.

3. **Never silence a hard block.** If the PreToolUse gate denies an action
   because of an unallowed critical finding, do **not** try to work around it,
   disable the hook, or edit `.scry/`/`settings.json` to get past it. Surface the
   exact override path instead:

   ```
   npx @phazur/scry allow <RULEID> <skillName> --reason "<why this is safe>"
   ```

   and let the user make that decision consciously.

## Boundaries

- The scan is static and deterministic. It catches known patterns, not
  everything. Say so — a clean report means "nothing concealed surfaced by the
  deterministic checks", not "guaranteed safe".
- Do not fabricate findings, severities, or threat classes. If Scry reported it,
  cite it. If it didn't, don't.

Deterministic scan · Scry v1 by Phazur Labs · Built for inheritance, not hype.
