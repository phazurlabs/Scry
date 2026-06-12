import { describe, expect, it } from 'vitest';

import rule from '../../src/scanner/rules/scry005.js';
import { ctxFrom, scriptCtx } from '../helpers.js';

const ids = (ctx: Parameters<typeof rule.check>[0]) =>
  rule.check(ctx).map((f) => f.ruleId);

describe('SCRY005 — obfuscation signals', () => {
  it('catches eval(atob(...))', () => {
    expect(ids(scriptCtx('a.js', 'eval(atob("Y3VybA=="))'))).toContain('SCRY005');
  });

  it('catches exec(base64.b64decode(...))', () => {
    expect(ids(scriptCtx('a.py', 'exec(base64.b64decode(payload))'))).toContain(
      'SCRY005',
    );
  });

  it('catches zero-width characters in markdown', () => {
    expect(ids(ctxFrom([{ path: 'doc.md', content: 'hello\u200Bworld' }]))).toContain(
      'SCRY005',
    );
  });

  it('ignores base64 encoding without execution', () => {
    expect(ids(scriptCtx('a.sh', 'base64 logo.png > logo.b64'))).not.toContain('SCRY005');
  });

  it('ignores a single fromCharCode call', () => {
    expect(ids(scriptCtx('a.js', 'const id = String.fromCharCode(65);'))).not.toContain(
      'SCRY005',
    );
  });
});
