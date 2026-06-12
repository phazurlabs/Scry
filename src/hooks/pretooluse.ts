/**
 * PreToolUse hard gate.
 *
 * For a Bash (or file) action that touches an installed skill, decide whether to
 * block it. The fast path consults the lock: if the skill's hash is current and
 * it has critical findings that are not on the allowlist, deny. If the skill is
 * unknown or its content changed since the last scan, run a fresh deterministic
 * scan inline (no network, no LLM) and decide from that, refreshing the lock.
 *
 * Fail-open is absolute here: any error → allow. We would rather miss a finding
 * than brick someone's session over a bug in our own gate.
 *
 * Output contract (Claude Code hooks): exit 0 with a JSON object on stdout. To
 * block we emit permissionDecision "deny"; otherwise we stay silent and let the
 * normal permission flow decide.
 */
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { scanSkill } from '../scanner/index.js';
import { hashSkill } from '../scanner/load.js';
import {
  entryFromReport,
  isAllowed,
  loadLock,
  saveLock,
  unallowedCriticals,
  type Lock,
} from '../lockfile.js';
import { resolvePaths } from '../paths.js';
import type { Finding } from '../report/schema.js';
import { readHookInput, resolveSkill, type HookInput } from './shared.js';

export interface GateDecision {
  block: boolean;
  reason?: string;
}

const PKG = '@phazur/scry';

function denyReason(skill: string, findings: Finding[]): string {
  const lines = [
    `Scry blocked this action. Skill "${skill}" has unallowed CRITICAL findings:`,
  ];
  for (const f of findings) {
    lines.push(`  • ${f.ruleId} ${f.file}:${f.line} — ${f.title}`);
  }
  lines.push(`Review:   npx ${PKG} audit`);
  const first = findings[0]?.ruleId ?? 'SCRYxxx';
  lines.push(
    `Override (logged): npx ${PKG} allow ${first} ${skill} --reason "<why this is safe>"`,
  );
  return lines.join('\n');
}

/** Pure decision, given an input. Exported for tests. */
export function evaluateGate(input: HookInput): GateDecision {
  const skill = resolveSkill(input);
  if (!skill) return { block: false };

  const paths = resolvePaths({ cwd: input.cwd });
  const lock: Lock = loadLock(paths.lockPath);

  let hash: string;
  try {
    hash = hashSkill(skill.dir);
  } catch {
    return { block: false }; // cannot hash → fail open
  }

  const entry = lock.skills[skill.name];
  const fresh = entry && entry.hash === hash && !entry.stale;

  if (fresh) {
    const unallowed = unallowedCriticals(lock, skill.name);
    if (unallowed.length === 0) return { block: false };
    // Block — enrich the message with file:line detail from a fresh scan.
    const report = scanSkill(skill.dir);
    const findings = report.findings.filter(
      (f) => f.severity === 'critical' && !isAllowed(lock, skill.name, f.ruleId),
    );
    return { block: true, reason: denyReason(skill.name, findings) };
  }

  // Unknown or changed: scan inline and refresh the lock (best effort).
  const report = scanSkill(skill.dir);
  try {
    const next = entryFromReport(report);
    next.dir = skill.dir;
    lock.skills[skill.name] = next;
    saveLock(paths.lockPath, lock);
  } catch {
    // Persisting the lock is best-effort; never block on it.
  }

  const findings = report.findings.filter(
    (f) => f.severity === 'critical' && !isAllowed(lock, skill.name, f.ruleId),
  );
  if (findings.length === 0) return { block: false };
  return { block: true, reason: denyReason(skill.name, findings) };
}

function emitDeny(reason: string): void {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }) + '\n',
  );
}

export async function main(): Promise<void> {
  try {
    const input = await readHookInput();
    if (!input) return; // nothing to decide → allow
    const decision = evaluateGate(input);
    if (decision.block && decision.reason) emitDeny(decision.reason);
  } catch {
    // Absolute fail-open: swallow everything and allow.
  }
}

// Run only when invoked directly as a hook script (not when imported by tests).
if (argv[1] && fileURLToPath(import.meta.url) === argv[1]) {
  main().then(
    () => process.exit(0),
    () => process.exit(0),
  );
}
