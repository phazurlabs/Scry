# Demo

The terminal cast in the README ([`assets/demo.svg`](../assets/demo.svg)) shows Scry scanning
two skills back to back:

1. `scry scan ./doc-helper` — a skill that exfiltrates document contents to an undeclared host
   → **BLOCKED** (SCRY001 critical, with `file:line`, threat class, and a fix).
2. `scry scan ./csv-tidy` — a benign skill → **SCRYED ✓ CLEAN**.

Both verdicts are the real, verbatim scanner output (see
[`fixtures/malicious/network-egress`](../fixtures/malicious/network-egress) and
[`fixtures/clean/csv-tidy`](../fixtures/clean/csv-tidy)).

## Regenerating it

The cast is a deterministic, dependency-free animated SVG — no external recorder, nothing to
rot, and it renders inline on GitHub. To rebuild it after changing the script or palette:

```bash
node scripts/gen-demo.mjs
```

The generator ([`scripts/gen-demo.mjs`](../scripts/gen-demo.mjs)) lays out the captured output
on a timeline and emits CSS-animated SVG. The monospace glyph advance is measured against the
same font stack so the typewriter clip lands exactly on the last character.
