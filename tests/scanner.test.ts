import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanSkill } from '../src/scanner/index.js';

const FIX = join(import.meta.dirname, '..', 'fixtures');

describe('scanner determinism & verdicts', () => {
  it('produces byte-identical reports for the same input (excluding timestamp)', () => {
    const a = scanSkill(join(FIX, 'malicious', 'network-egress'), { now: 'T' });
    const b = scanSkill(join(FIX, 'malicious', 'network-egress'), { now: 'T' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('keeps the same hash regardless of scan time', () => {
    const a = scanSkill(join(FIX, 'clean', 'pdf-text'), { now: '2020' });
    const b = scanSkill(join(FIX, 'clean', 'pdf-text'), { now: '2099' });
    expect(a.hash).toBe(b.hash);
    expect(a.timestamp).not.toBe(b.timestamp);
  });

  it('blocks on a critical finding', () => {
    const r = scanSkill(join(FIX, 'malicious', 'credential-theft'), { now: 'T' });
    expect(r.verdict).toBe('blocked');
  });

  it('flags on a warn-only finding', () => {
    const r = scanSkill(join(FIX, 'malicious', 'obfuscation'), { now: 'T' });
    expect(r.verdict).toBe('flagged');
  });

  it('fails open with a clean verdict on a missing directory', () => {
    const r = scanSkill(join(FIX, 'does-not-exist'), { now: 'T' });
    expect(r.verdict).toBe('clean');
    expect(r.scanError).toBeDefined();
  });
});

describe('edge-case fixtures (near-misses)', () => {
  const cases: Array<[string, string]> = [
    ['network', 'SCRY001'],
    ['credentials', 'SCRY002'],
    ['destructive', 'SCRY003'],
    ['injection', 'SCRY004'],
    ['obfuscation', 'SCRY005'],
    ['self-mod', 'SCRY006'],
    ['unpinned', 'SCRY007'],
    ['misrepresent', 'SCRY008'],
    ['excessive', 'SCRY009'],
    ['provenance', 'SCRY010'],
  ];

  for (const [dir, ruleId] of cases) {
    it(`${dir} does not trip ${ruleId}`, () => {
      const r = scanSkill(join(FIX, 'edge-cases', dir), { now: 'T' });
      expect(r.findings.map((f) => f.ruleId)).not.toContain(ruleId);
    });
  }
});

describe('malicious fixtures trip their target rule', () => {
  const cases: Array<[string, string]> = [
    ['network-egress', 'SCRY001'],
    ['credential-theft', 'SCRY002'],
    ['destructive', 'SCRY003'],
    ['prompt-injection', 'SCRY004'],
    ['obfuscation', 'SCRY005'],
    ['self-mod', 'SCRY006'],
    ['unpinned', 'SCRY007'],
    ['misrepresent', 'SCRY008'],
    ['excessive', 'SCRY009'],
    ['provenance', 'SCRY010'],
  ];

  for (const [dir, ruleId] of cases) {
    it(`${dir} trips ${ruleId}`, () => {
      const r = scanSkill(join(FIX, 'malicious', dir), { now: 'T' });
      expect(r.findings.map((f) => f.ruleId)).toContain(ruleId);
    });
  }
});
