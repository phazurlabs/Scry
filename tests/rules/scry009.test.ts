import { describe, expect, it } from 'vitest';

import rule from '../../src/scanner/rules/scry009.js';
import { ctxFrom, fileFrom } from '../helpers.js';

const ids = (ctx: Parameters<typeof rule.check>[0]) =>
  rule.check(ctx).map((f) => f.ruleId);

describe('SCRY009 — excessive scope', () => {
  it('catches a shipped binary/executable', () => {
    const ctx = ctxFrom([
      { path: 'SKILL.md', content: '---\nname: t\n---' },
      { path: 'bin/agent.bin', content: 'binary-ish' },
    ]);
    expect(ids(ctx)).toContain('SCRY009');
  });

  it('catches an unusually large number of scripts', () => {
    const files = Array.from({ length: 21 }, (_, i) => ({
      path: `s${i}.sh`,
      content: 'echo hi',
    }));
    expect(ids(ctxFrom(files))).toContain('SCRY009');
  });

  it('ignores a small image asset', () => {
    const png = fileFrom('assets/icon.png', 'pngdata');
    const ctx = ctxFrom([
      { path: 'SKILL.md', content: '---\nname: t\n---' },
      { path: 'run.sh', content: 'echo hi' },
    ]);
    ctx.files.push(png);
    expect(ids(ctx)).not.toContain('SCRY009');
  });

  it('ignores a skill with a couple of scripts', () => {
    const ctx = ctxFrom([
      { path: 'a.sh', content: 'echo a' },
      { path: 'b.sh', content: 'echo b' },
    ]);
    expect(ids(ctx)).not.toContain('SCRY009');
  });
});
