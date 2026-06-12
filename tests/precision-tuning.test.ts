/**
 * Regression tests for false positives found while scanning real-world skill
 * repos (see eval/corpus.md). Each case here is a pattern that previously fired
 * incorrectly on a legitimate public skill and must stay silent.
 */
import { describe, expect, it } from 'vitest';

import scry001 from '../src/scanner/rules/scry001.js';
import scry004 from '../src/scanner/rules/scry004.js';
import scry006 from '../src/scanner/rules/scry006.js';
import scry007 from '../src/scanner/rules/scry007.js';
import { parseFrontmatter } from '../src/scanner/parsers/frontmatter.js';
import { ctxFrom, scriptCtx } from './helpers.js';

const ids = (rule: { check: (c: never) => { ruleId: string }[] }, ctx: unknown) =>
  rule.check(ctx as never).map((f) => f.ruleId);

describe('precision tuning (from corpus.md)', () => {
  it('SCRY001: loopback socket health-check is not egress', () => {
    const ctx = scriptCtx(
      's.py',
      "with socket.create_connection(('localhost', port)): pass",
    );
    expect(ids(scry001, ctx)).not.toContain('SCRY001');
  });

  it('SCRY001: requiring the http module is not a network call', () => {
    expect(
      ids(scry001, scriptCtx('s.cjs', "const http = require('http');")),
    ).not.toContain('SCRY001');
  });

  it('SCRY001: the English word "got" is not the got HTTP library', () => {
    const ctx = scriptCtx('s.ts', 'throw new Error(`got ${events.length} events`);');
    expect(ids(scry001, ctx)).not.toContain('SCRY001');
  });

  it('SCRY006: writing to /dev/null is not self-modification', () => {
    expect(
      ids(scry006, scriptCtx('s.sh', 'npm test "$f" > /dev/null 2>&1 || true')),
    ).not.toContain('SCRY006');
  });

  it('SCRY007: "pip install" inside a string literal is not a command', () => {
    const ctx = ctxFrom([
      { path: 'lint.py', content: 'msg = "Install with: pip install detect-secrets"' },
    ]);
    expect(ids(scry007, ctx)).not.toContain('SCRY007');
  });

  it('SCRY004: a cited injection phrase in docs is downgraded to warn', () => {
    const ctx = ctxFrom([
      {
        path: 'SKILL.md',
        content: 'Avoid override-style language ("ignore the previous instruction").',
      },
    ]);
    const findings = scry004.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('warn');
  });

  it('frontmatter: YAML block-scalar descriptions are parsed', () => {
    const fm = parseFrontmatter(
      '---\nname: t\ndescription: |-\n  A long multi-line\n  API reference.\n---\n',
    );
    expect(fm?.description).toContain('API reference');
  });
});
