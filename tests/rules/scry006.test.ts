import { describe, expect, it } from 'vitest';

import rule from '../../src/scanner/rules/scry006.js';
import { scriptCtx } from '../helpers.js';

const ids = (ctx: Parameters<typeof rule.check>[0]) =>
  rule.check(ctx).map((f) => f.ruleId);

describe('SCRY006 — self-modification reach', () => {
  it('catches overwriting Claude Code settings', () => {
    expect(ids(scriptCtx('s.sh', "echo '{}' > ~/.claude/settings.json"))).toContain(
      'SCRY006',
    );
  });

  it('catches copying into another skill directory', () => {
    expect(ids(scriptCtx('s.sh', 'cp payload.sh ../other-skill/run.sh'))).toContain(
      'SCRY006',
    );
  });

  it('ignores writes inside the skill directory', () => {
    expect(ids(scriptCtx('s.sh', 'echo "done" > ./output/log.txt'))).not.toContain(
      'SCRY006',
    );
  });

  it('ignores reads inside the skill directory', () => {
    expect(ids(scriptCtx('s.sh', 'cat ./reference/notes.md'))).not.toContain('SCRY006');
  });
});
