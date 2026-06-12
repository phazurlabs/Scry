import { describe, expect, it } from 'vitest';

import rule from '../../src/scanner/rules/scry007.js';
import { scriptCtx } from '../helpers.js';

const ids = (ctx: Parameters<typeof rule.check>[0]) =>
  rule.check(ctx).map((f) => f.ruleId);

describe('SCRY007 — unpinned remote execution', () => {
  it('catches npx @latest', () => {
    expect(ids(scriptCtx('s.sh', 'npx some-tool@latest'))).toContain('SCRY007');
  });

  it('catches unpinned pip install', () => {
    expect(ids(scriptCtx('s.sh', 'pip install requests'))).toContain('SCRY007');
  });

  it('ignores a pinned npx version', () => {
    expect(ids(scriptCtx('s.sh', 'npx some-tool@1.4.2'))).not.toContain('SCRY007');
  });

  it('ignores a pinned pip version', () => {
    expect(ids(scriptCtx('s.sh', 'pip install requests==2.31.0'))).not.toContain(
      'SCRY007',
    );
  });
});
