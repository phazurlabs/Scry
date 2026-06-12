/**
 * End-to-end PreToolUse gate tests. We stand up a throwaway environment with a
 * real malicious skill and a real lock, then drive the gate two ways:
 *  - in-process via evaluateGate (the decision logic), and
 *  - out-of-process by spawning the compiled hook and feeding it stdin JSON
 *    exactly as Claude Code would (the wire contract).
 */
import { execSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auditSkills, writeLock } from '../src/audit.js';
import { evaluateGate } from '../src/hooks/pretooluse.js';
import { loadLock, saveLock } from '../src/lockfile.js';
import { discoverSkills } from '../src/paths.js';

const ROOT = join(import.meta.dirname, '..');
const FIX = join(ROOT, 'fixtures');

let env: { cwd: string; skillsDir: string; lockPath: string };
const prevSkillsEnv = process.env.SCRY_SKILLS_DIRS;

beforeAll(() => {
  const cwd = mkdtempSync(join(tmpdir(), 'scry-gate-'));
  const skillsDir = join(cwd, 'skills');
  cpSync(join(FIX, 'malicious', 'network-egress'), join(skillsDir, 'doc-helper'), {
    recursive: true,
  });
  cpSync(join(FIX, 'clean', 'pdf-text'), join(skillsDir, 'pdf-text'), {
    recursive: true,
  });

  process.env.SCRY_SKILLS_DIRS = skillsDir;
  const lockPath = join(cwd, '.scry', 'lock.json');
  writeLock(lockPath, auditSkills(discoverSkills([skillsDir])), 'T');

  env = { cwd, skillsDir, lockPath };

  // Build the compiled hook fresh so the spawn test never runs stale output.
  execSync('npx tsc -p tsconfig.build.json', { cwd: ROOT, stdio: 'ignore' });
});

afterAll(() => {
  if (prevSkillsEnv === undefined) delete process.env.SCRY_SKILLS_DIRS;
  else process.env.SCRY_SKILLS_DIRS = prevSkillsEnv;
});

function bashInput(command: string) {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    cwd: env.cwd,
    tool_input: { command },
  };
}

describe('PreToolUse gate (in-process)', () => {
  it('blocks a Bash action running a malicious skill', () => {
    const d = evaluateGate(
      bashInput(`bash ${env.skillsDir}/doc-helper/scripts/run.sh notes.txt`),
    );
    expect(d.block).toBe(true);
    expect(d.reason).toContain('SCRY001');
    expect(d.reason).toContain('allow');
  });

  it('allows a Bash action running a clean skill', () => {
    const d = evaluateGate(
      bashInput(`python3 ${env.skillsDir}/pdf-text/scripts/extract.py a.pdf`),
    );
    expect(d.block).toBe(false);
  });

  it('allows once the critical is on the allowlist', () => {
    const lock = loadLock(env.lockPath);
    lock.allowlist.push({
      ruleId: 'SCRY001',
      skill: 'doc-helper',
      reason: 'reviewed mirror',
      at: 'T',
      by: 'test',
    });
    saveLock(env.lockPath, lock);

    const d = evaluateGate(
      bashInput(`bash ${env.skillsDir}/doc-helper/scripts/run.sh x`),
    );
    expect(d.block).toBe(false);

    // Restore lock state: writeLock preserves the allowlist, so clear it explicitly.
    const restored = loadLock(env.lockPath);
    restored.allowlist = [];
    saveLock(env.lockPath, restored);
  });

  it('allows actions that touch no known skill', () => {
    expect(evaluateGate(bashInput('ls -la /tmp')).block).toBe(false);
  });
});

describe('PreToolUse gate (compiled hook, wire contract)', () => {
  it('emits a deny decision on stdout for a malicious skill', () => {
    const input = JSON.stringify(
      bashInput(`bash ${env.skillsDir}/doc-helper/scripts/run.sh notes.txt`),
    );
    const res = spawnSync('node', [join(ROOT, 'dist', 'hooks', 'pretooluse.js')], {
      input,
      env: { ...process.env, SCRY_SKILLS_DIRS: env.skillsDir },
      encoding: 'utf8',
    });
    expect(res.status).toBe(0); // fail-open exit code, never non-zero
    const out = JSON.parse(res.stdout);
    expect(out.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(out.hookSpecificOutput.permissionDecisionReason).toContain('SCRY001');
  });
});
