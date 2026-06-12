/**
 * Audit orchestration shared by the CLI and init: scan a set of skills and fold
 * the results into the lock file, preserving the existing allowlist (the
 * allowlist records human decisions and must survive re-audits).
 */
import { scanSkill } from './scanner/index.js';
import { emptyLock, entryFromReport, loadLock, saveLock, type Lock } from './lockfile.js';
import type { DiscoveredSkill } from './paths.js';
import type { DiscernmentReport } from './report/schema.js';

export interface AuditedSkill {
  skill: DiscoveredSkill;
  report: DiscernmentReport;
}

/** Scan every given skill with a single shared timestamp. */
export function auditSkills(skills: DiscoveredSkill[], now?: string): AuditedSkill[] {
  const ts = now ?? new Date().toISOString();
  return skills.map((skill) => ({ skill, report: scanSkill(skill.dir, { now: ts }) }));
}

/** Rebuild the lock's skill entries from reports, keeping the allowlist intact. */
export function writeLock(lockPath: string, audited: AuditedSkill[], now?: string): Lock {
  const ts = now ?? new Date().toISOString();
  const existing = loadLock(lockPath);
  const lock = emptyLock(ts);
  lock.allowlist = existing.allowlist; // preserve logged decisions

  for (const { skill, report } of audited) {
    const entry = entryFromReport(report);
    entry.dir = skill.dir;
    lock.skills[skill.name] = entry;
  }

  saveLock(lockPath, lock);
  return lock;
}
