/**
 * The lock file (.scry/lock.json) is Scry's memory between runs: for each skill
 * it records the content hash that was scanned, the verdict, the unallowed
 * critical rule ids, and a staleness flag. It also holds the allowlist — the
 * conscious, logged decisions to permit a specific critical for a specific skill.
 *
 * The PreToolUse hook reads this file to decide, in well under a second, whether
 * a skill action should be blocked, without re-running a full scan every time.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { z } from 'zod';

import type { DiscernmentReport } from './report/schema.js';
import { CRITERIA_VERSION } from './report/schema.js';

export const LOCK_VERSION = '1.0.0';

const skillEntrySchema = z.object({
  dir: z.string(),
  hash: z.string(),
  verdict: z.enum(['clean', 'flagged', 'blocked']),
  /** Critical rule ids found, regardless of allowlist. */
  criticals: z.array(z.string()),
  stale: z.boolean(),
  scannedAt: z.string(),
});

const allowEntrySchema = z.object({
  ruleId: z.string(),
  skill: z.string(),
  reason: z.string(),
  at: z.string(),
  by: z.string(),
});

export const lockSchema = z.object({
  version: z.string(),
  criteriaVersion: z.string(),
  generatedAt: z.string(),
  skills: z.record(skillEntrySchema),
  allowlist: z.array(allowEntrySchema),
});

export type SkillEntry = z.infer<typeof skillEntrySchema>;
export type AllowEntry = z.infer<typeof allowEntrySchema>;
export type Lock = z.infer<typeof lockSchema>;

export function emptyLock(now = new Date().toISOString()): Lock {
  return {
    version: LOCK_VERSION,
    criteriaVersion: CRITERIA_VERSION,
    generatedAt: now,
    skills: {},
    allowlist: [],
  };
}

/** Load a lock file, returning an empty lock if it is missing or unparseable. */
export function loadLock(lockPath: string): Lock {
  let text: string;
  try {
    text = readFileSync(lockPath, 'utf8');
  } catch {
    return emptyLock();
  }
  try {
    return lockSchema.parse(JSON.parse(text));
  } catch {
    // A corrupt lock should not crash a hook; treat it as empty (fail open).
    return emptyLock();
  }
}

export function saveLock(lockPath: string, lock: Lock): void {
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

/** True when this exact (rule, skill) pair has a logged allowlist entry. */
export function isAllowed(lock: Lock, skill: string, ruleId: string): boolean {
  return lock.allowlist.some((e) => e.skill === skill && e.ruleId === ruleId);
}

/** Critical rule ids for a skill that are NOT covered by the allowlist. */
export function unallowedCriticals(lock: Lock, skill: string): string[] {
  const entry = lock.skills[skill];
  if (!entry) return [];
  return entry.criticals.filter((ruleId) => !isAllowed(lock, skill, ruleId));
}

/** Fold a fresh report into a lock entry. */
export function entryFromReport(report: DiscernmentReport): SkillEntry {
  const criticals = [
    ...new Set(
      report.findings.filter((f) => f.severity === 'critical').map((f) => f.ruleId),
    ),
  ].sort();
  return {
    dir: '',
    hash: report.hash,
    verdict: report.verdict,
    criticals,
    stale: false,
    scannedAt: report.timestamp,
  };
}
