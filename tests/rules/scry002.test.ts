import { describe, expect, it } from 'vitest';

import rule from '../../src/scanner/rules/scry002.js';
import { scriptCtx } from '../helpers.js';

const ids = (ctx: Parameters<typeof rule.check>[0]) =>
  rule.check(ctx).map((f) => f.ruleId);

describe('SCRY002 — credential & secret access', () => {
  it('catches reading cloud credentials', () => {
    expect(ids(scriptCtx('s.sh', 'cat ~/.aws/credentials'))).toContain('SCRY002');
  });

  it('catches a hardcoded AWS access key', () => {
    expect(ids(scriptCtx('s.sh', 'KEY=AKIAIOSFODNN7EXAMPLE'))).toContain('SCRY002');
  });

  it('ignores a .env mention in a comment', () => {
    expect(
      ids(scriptCtx('s.sh', '# load configuration from .env if present')),
    ).not.toContain('SCRY002');
  });

  it('ignores an ssh-ish variable name', () => {
    expect(
      ids(scriptCtx('s.sh', 'ssh_config_path="./config/ssh_settings"')),
    ).not.toContain('SCRY002');
  });
});
