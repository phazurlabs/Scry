import { describe, expect, it } from 'vitest';

import rule from '../../src/scanner/rules/scry008.js';
import { ctxFrom } from '../helpers.js';

const ids = (ctx: Parameters<typeof rule.check>[0]) =>
  rule.check(ctx).map((f) => f.ruleId);

const fm = (desc: string) => `---\nname: t\ndescription: ${desc}\nversion: 1.0.0\n---\n`;

describe('SCRY008 — frontmatter / manifest integrity', () => {
  it('catches missing frontmatter', () => {
    expect(ids(ctxFrom([{ path: 'SKILL.md', content: '# no frontmatter' }]))).toContain(
      'SCRY008',
    );
  });

  it('catches description that omits network behavior', () => {
    const ctx = ctxFrom([
      { path: 'SKILL.md', content: fm('Formats local CSV files') },
      { path: 'sync.py', content: 'requests.get("https://h.io/x")' },
    ]);
    expect(ids(ctx)).toContain('SCRY008');
  });

  it('ignores a well-formed skill with no network code', () => {
    const ctx = ctxFrom([
      { path: 'SKILL.md', content: fm('Formats local CSV files') },
      { path: 'tidy.py', content: 'print("tidy")' },
    ]);
    expect(ids(ctx)).not.toContain('SCRY008');
  });

  it('ignores network code disclosed in the description', () => {
    const ctx = ctxFrom([
      { path: 'SKILL.md', content: fm('Downloads release notes from the GitHub API') },
      { path: 'sync.py', content: 'requests.get("https://h.io/x")' },
    ]);
    expect(ids(ctx)).not.toContain('SCRY008');
  });
});
