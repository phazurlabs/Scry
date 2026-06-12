# Contributing to Scry

Scry is meant to be forked, read, and audited by strangers. Contributions are
welcome — especially new rules — but they are held to a deliberately strict bar,
because the whole product depends on the gate staying trustworthy and quiet.

## The two things that matter most

1. **Precision over recall.** A false positive costs more than a missed finding.
   A noisy gate gets uninstalled, and then it protects no one. Every check must
   have a near-zero false-positive rate or it ships as `info`, not `warn`/`block`.
2. **Deterministic core.** No network calls, no LLM judgment, no randomness in
   the scanner. Same input → same output, byte-identical report (timestamp
   excluded). If your rule needs to reach the network or "ask a model," it does
   not belong in the deterministic core.

## Rule anatomy

A rule is a single file in `src/scanner/rules/scryNNN.ts` that exports a default
object implementing the `Rule` interface:

```ts
export const rule: Rule = {
  id: 'SCRY0NN',
  severity: 'critical' | 'warn' | 'info',
  threatClass: '<documented threat class citation>',
  title: '<short human title>',
  check(ctx: SkillContext): Finding[] {
    /* pure function of ctx */
  },
};
export default rule;
```

The `check` function receives a fully pre-loaded `SkillContext` (every file, the
parsed frontmatter, the optional `scry.allow` manifest). **It must not touch the
filesystem or the network** — it is a pure function of its input. That purity is
what makes the core deterministic and testable.

Each finding must include: rule id, file path, 1-based line number, the matched
snippet, a one-sentence explanation, and a one-sentence remediation. Use the
`finding()` / `skillFinding()` helpers in `src/scanner/util.ts`.

### Required file header

Every rule file's top comment must contain:

- the **threat class citation** (OWASP Top 10 for Agentic Applications / OWASP
  Agentic Skills Top 10). No citation, no rule.
- **two example strings** the rule SHOULD catch.
- **two near-miss strings** the rule MUST NOT catch.

## The false-positive budget

Your rule has to clear two gates before it can be merged:

1. **The precision test.** `eval/precision.test.ts` asserts that the clean
   fixtures (`fixtures/clean/`) produce zero findings of severity `warn` or
   `critical`. If your rule fires on a benign skill, tune it down or drop its
   severity to `info`.
2. **A dedicated unit test.** Add `tests/rules/scryNNN.test.ts` mirroring the four
   cases from your file header (two catches, two near-misses). Add a near-miss
   fixture under `fixtures/edge-cases/` if it helps.

Before opening a PR, also run the rule against real skills (see
[`eval/corpus.md`](eval/corpus.md)). If it produces a false positive on a real,
legitimate skill, fix it and record the tuning decision in `corpus.md`.

## Conventions

- TypeScript, ESM, Node >= 20. Strict tsconfig.
- No file over 400 lines. No `TODO`s in shipped code.
- Run before pushing:

  ```bash
  npm run build && npm test && npm run lint && npm run format:check
  ```

## Adding a rule: checklist

- [ ] `src/scanner/rules/scryNNN.ts` with the required header.
- [ ] Registered in `src/scanner/rules/index.ts`.
- [ ] `CRITERIA_VERSION` bumped in `src/report/schema.ts`.
- [ ] `tests/rules/scryNNN.test.ts` with the four mirrored cases.
- [ ] Precision test still green.
- [ ] Run against the corpus; record any tuning in `eval/corpus.md`.
- [ ] Rule listed in the README table.

_Built for inheritance, not hype._
