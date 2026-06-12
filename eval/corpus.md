# Corpus evaluation

Scry's rules are tuned against real, public Claude Code skills — not just the
synthetic fixtures. This file records how to reproduce that evaluation and every
tuning decision that came out of it. Prime Directive #1 is precision: a rule that
produces a false positive on a legitimate skill gets tuned down before it ships.

## How to run it

The scanner is offline and deterministic, so anyone can reproduce these numbers:

```bash
# 1. Clone some public skill collections
mkdir -p /tmp/corpus && cd /tmp/corpus
git clone --depth 1 https://github.com/anthropics/skills anthropics_skills
git clone --depth 1 https://github.com/obra/superpowers obra_superpowers

# 2. Build Scry
cd /path/to/scry && npm install && npm run build

# 3. Scan every skill (a directory containing SKILL.md) and tally verdicts
node --input-type=module -e '
import { scanSkill } from "./dist/scanner/index.js";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
const roots = ["/tmp/corpus/anthropics_skills","/tmp/corpus/obra_superpowers"];
let dirs = [];
for (const r of roots) dirs.push(...execSync(`find ${r} -name SKILL.md -not -path "*/.git/*"`,{encoding:"utf8"}).split("\n").filter(Boolean).map(dirname));
let clean=0, flagged=0, blocked=0;
for (const d of dirs){ const v = scanSkill(d).verdict; v==="clean"?clean++:v==="flagged"?flagged++:blocked++; }
console.log({ skills: dirs.length, clean, flagged, blocked });
'
```

## Corpus

| Source                        | Skills scanned |
| ----------------------------- | -------------- |
| `anthropics/skills`           | 18             |
| `obra/superpowers`            | 14             |
| `anthropics/claude-cookbooks` | 4              |
| `w3c/web-performance`         | 3              |
| `crazyguitar/pysheeet`        | 2              |
| **Total (5 repos)**           | **41**         |

(Counts reflect the repositories at the time of evaluation; they are pinned only
to their default branch, so re-running later may differ slightly.)

## Result after tuning

| Verdict | Count |
| ------- | ----- |
| CLEAN   | 40    |
| FLAGGED | 1     |
| BLOCKED | 0     |

- **Zero false-positive blocks.** No legitimate skill is blocked.
- The single FLAGGED skill is `anthropics/skills/claude-api`, on one `SCRY004`
  **warn**: its reference docs quote prompt-injection phrases as examples of what
  to avoid (e.g. _"disregard the previous instruction"_). Surfacing that as a
  non-blocking warn is correct discernment — the text does contain the phrasing —
  and it is downgraded from critical precisely because the phrase is cited, not a
  bare directive.
- Remaining findings are all `info` (provenance gaps and one excessive-scope
  note), which never affect the verdict.

## Tuning decisions

Each item below is a false positive observed in the first pass and the change
made in response. Every change is covered by a regression test in
`tests/precision-tuning.test.ts`.

1. **SCRY001 — loopback is not egress.** `webapp-testing` polls a local test
   server with `socket.create_connection(('localhost', port))`. Connecting to
   `localhost`/`127.0.0.1`/`0.0.0.0`/`::1` is local, not exfiltration. Added
   loopback filtering: a call whose only destination is loopback (or a hostless
   call on a line that references a loopback literal) is ignored.

2. **SCRY001 — importing a module is not a call.** `brainstorming/server.cjs`
   builds a local HTTP/WebSocket server and opens with `require('http')`.
   Importing the `http` module is not an outbound call. Removed the
   `require('http'|'https')` signal; only actual client calls
   (`http.request`/`https.get`/`fetch`/library usage) count.

3. **SCRY001 — the English word "got".** A `.ts` error message
   `` `got ${n} events` `` matched a bare-word `got` library pattern. Network
   library names now require call/member/import context (`got(`, `got.`,
   `from 'got'`), so the ordinary English word no longer matches.

4. **SCRY006 — `/dev/null` is not self-modification.** `find-polluter.sh` uses
   `npm test … > /dev/null 2>&1`. Redirecting to `/dev/null` (and other `/dev/`,
   `/proc/` pseudo-files) discards output; it is not a write to the wider
   filesystem. These sinks are now excluded from the escape check.

5. **SCRY004 — cited injection phrases.** `claude-api` documentation quotes
   attack phrases as examples to avoid. A phrase that exists only inside quotes or
   backticks is a citation, not a directive, so it is downgraded from critical to
   warn (per the rule's "when ambiguous, downgrade" mandate).

6. **SCRY004 — exfiltration needs a destination.** Benign API prose like
   _"send the full conversation history each time"_ matched the exfiltration
   pattern. The pattern now requires an explicit destination (`to`/`at`/`via`),
   so disclosing stateless-API behavior no longer trips it while
   _"send the conversation history to the maintainer"_ still does.

7. **SCRY008 — YAML block-scalar descriptions.** `claude-api` declares its
   description with a `|-` block scalar. The frontmatter reader previously saw an
   empty description and flagged a too-short/mismatched description. The reader
   now parses block scalars, so multi-line descriptions are read correctly.

8. **SCRY007 — `pip install` inside a string literal.** `claude-cookbooks`
   ships a notebook linter whose help text and docstrings contain the phrase
   `pip install …` (e.g. `"Install with: pip install detect-secrets"`). Those are
   strings, not commands. Command patterns are now matched after stripping quoted
   spans, so a literal mention no longer counts as an unpinned install.

Deterministic scan · Scry v1 by Phazur Labs · Built for inheritance, not hype.
