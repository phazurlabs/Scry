/**
 * PostToolUse + SessionStart re-audit handler.
 *
 * After a Write/Edit, or at the start of a session, we compare each relevant
 * skill's current content hash against what the lock recorded. If they differ,
 * the skill is marked stale so the PreToolUse gate re-scans it before its next
 * gated use, rather than trusting an out-of-date verdict.
 *
 * This handler never blocks (PostToolUse cannot, and SessionStart should not).
 * It only updates the lock. Fail-open throughout.
 */
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { hashSkill } from '../scanner/load.js';
import { loadLock, saveLock, type Lock } from '../lockfile.js';
import { discoverSkills, resolvePaths } from '../paths.js';
import { readHookInput, resolveSkill, type HookInput } from './shared.js';

/** Mark a single skill stale if its hash drifted from the lock. Returns true if changed. */
function refreshOne(lock: Lock, name: string, dir: string): boolean {
  const entry = lock.skills[name];
  if (!entry) return false;
  let hash: string;
  try {
    hash = hashSkill(dir);
  } catch {
    return false;
  }
  if (entry.hash !== hash && !entry.stale) {
    entry.stale = true;
    return true;
  }
  return false;
}

/** Update the lock's staleness flags. Exported for tests. */
export function refreshLock(input: HookInput): { changed: boolean } {
  const paths = resolvePaths({ cwd: input.cwd });
  const lock = loadLock(paths.lockPath);
  let changed = false;

  if (input.hook_event_name === 'SessionStart') {
    // Re-check every known skill at session start.
    for (const skill of discoverSkills(paths.skillsDirs)) {
      if (refreshOne(lock, skill.name, skill.dir)) changed = true;
    }
  } else {
    // PostToolUse: only the skill touched by this edit.
    const skill = resolveSkill(input);
    if (skill && refreshOne(lock, skill.name, skill.dir)) changed = true;
  }

  if (changed) {
    try {
      saveLock(paths.lockPath, lock);
    } catch {
      // best effort
    }
  }
  return { changed };
}

export async function main(): Promise<void> {
  try {
    const input = await readHookInput();
    if (!input) return;
    refreshLock(input);
  } catch {
    // Fail open: do nothing.
  }
}

if (argv[1] && fileURLToPath(import.meta.url) === argv[1]) {
  main().then(
    () => process.exit(0),
    () => process.exit(0),
  );
}
