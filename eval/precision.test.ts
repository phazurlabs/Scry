/**
 * The false-positive budget gate. Prime Directive #1 is precision over recall:
 * every clean fixture must produce ZERO findings of severity warn or critical.
 * If this test fails, a rule is too noisy and must be tuned down before merge.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanSkill } from '../src/scanner/index.js';

const CLEAN_DIR = join(import.meta.dirname, '..', 'fixtures', 'clean');

function cleanSkills(): string[] {
  return readdirSync(CLEAN_DIR).map((name) => join(CLEAN_DIR, name));
}

describe('precision: clean fixtures', () => {
  for (const dir of cleanSkills()) {
    it(`produces no warn+ findings for ${dir.split('/').pop()}`, () => {
      const report = scanSkill(dir, { now: 'T' });
      const noisy = report.findings.filter(
        (f) => f.severity === 'warn' || f.severity === 'critical',
      );
      expect(noisy, JSON.stringify(noisy, null, 2)).toHaveLength(0);
    });
  }

  it('reports a clean verdict for every clean fixture', () => {
    for (const dir of cleanSkills()) {
      const report = scanSkill(dir, { now: 'T' });
      expect(report.verdict, `${dir}: ${JSON.stringify(report.findings)}`).toBe('clean');
    }
  });
});
