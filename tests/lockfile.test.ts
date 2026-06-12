import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  emptyLock,
  entryFromReport,
  isAllowed,
  loadLock,
  saveLock,
  unallowedCriticals,
} from '../src/lockfile.js';
import type { DiscernmentReport } from '../src/report/schema.js';

function report(overrides: Partial<DiscernmentReport>): DiscernmentReport {
  return {
    schemaVersion: '1.0.0',
    criteriaVersion: '1.0.0',
    skillName: 'x',
    skillVersion: null,
    hash: 'abc',
    timestamp: 'T',
    verdict: 'blocked',
    findings: [],
    ...overrides,
  };
}

describe('lockfile', () => {
  it('round-trips through disk', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'scry-lock-')), 'lock.json');
    const lock = emptyLock('T');
    lock.skills.foo = entryFromReport(
      report({
        findings: [
          {
            ruleId: 'SCRY001',
            severity: 'critical',
            threatClass: 't',
            title: 'n',
            file: 'f',
            line: 1,
            snippet: 's',
            explanation: 'e',
            remediation: 'r',
          },
        ],
      }),
    );
    saveLock(path, lock);
    const loaded = loadLock(path);
    expect(loaded.skills.foo?.criticals).toEqual(['SCRY001']);
  });

  it('reports an empty lock when the file is missing', () => {
    expect(loadLock('/nope/lock.json').skills).toEqual({});
  });

  it('treats allowed criticals as allowed', () => {
    const lock = emptyLock('T');
    lock.skills.foo = entryFromReport(
      report({
        findings: [
          {
            ruleId: 'SCRY001',
            severity: 'critical',
            threatClass: 't',
            title: 'n',
            file: 'f',
            line: 1,
            snippet: 's',
            explanation: 'e',
            remediation: 'r',
          },
        ],
      }),
    );
    expect(unallowedCriticals(lock, 'foo')).toEqual(['SCRY001']);
    lock.allowlist.push({
      ruleId: 'SCRY001',
      skill: 'foo',
      reason: 'ok',
      at: 'T',
      by: 'me',
    });
    expect(isAllowed(lock, 'foo', 'SCRY001')).toBe(true);
    expect(unallowedCriticals(lock, 'foo')).toEqual([]);
  });
});
