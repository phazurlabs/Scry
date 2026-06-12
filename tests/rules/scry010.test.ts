import { describe, expect, it } from 'vitest';

import rule from '../../src/scanner/rules/scry010.js';
import { ctxFrom } from '../helpers.js';

const ids = (ctx: Parameters<typeof rule.check>[0]) =>
  rule.check(ctx).map((f) => f.ruleId);

describe('SCRY010 — provenance gaps', () => {
  it('catches a skill with no license and no version', () => {
    const ctx = ctxFrom([
      { path: 'SKILL.md', content: '---\nname: t\ndescription: a tool\n---' },
    ]);
    expect(ids(ctx)).toContain('SCRY010');
  });

  it('catches a skill with no source URL', () => {
    const ctx = ctxFrom([
      { path: 'SKILL.md', content: '---\nname: t\nversion: 1.0.0\n---' },
      { path: 'LICENSE', content: 'MIT' },
    ]);
    expect(ids(ctx)).toContain('SCRY010');
  });

  it('ignores a fully traceable skill', () => {
    const ctx = ctxFrom([
      {
        path: 'SKILL.md',
        content: '---\nname: t\nversion: 1.0.0\nhomepage: https://github.com/x/y\n---',
      },
      { path: 'LICENSE', content: 'MIT' },
    ]);
    expect(ids(ctx)).not.toContain('SCRY010');
  });

  it('ignores a skill with a repo URL in the README', () => {
    const ctx = ctxFrom([
      { path: 'SKILL.md', content: '---\nname: t\nversion: 2.0.0\n---' },
      { path: 'README.md', content: 'Source: https://github.com/x/y' },
      { path: 'LICENSE', content: 'MIT' },
    ]);
    expect(ids(ctx)).not.toContain('SCRY010');
  });
});
