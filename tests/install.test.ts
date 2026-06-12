import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  installHooks,
  isInstalled,
  uninstallHooks,
  withScryHooks,
} from '../src/install.js';

const HOOKS = '/opt/scry/dist/hooks';

function tempSettings(initial: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'scry-install-'));
  const path = join(dir, 'settings.json');
  writeFileSync(path, JSON.stringify(initial, null, 2) + '\n');
  return path;
}

describe('hook installer', () => {
  it('merges without clobbering existing hooks', () => {
    const existing = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-linter' }] },
        ],
      },
    };
    const merged = withScryHooks(existing, HOOKS);
    const pre = merged.hooks!.PreToolUse;
    // Original entry survives, Scry entry is appended.
    expect(pre.some((g) => g.hooks.some((h) => h.command === 'my-own-linter'))).toBe(
      true,
    );
    expect(
      pre.some((g) => g.hooks.some((h) => h.command.includes('pretooluse.js'))),
    ).toBe(true);
  });

  it('is idempotent — re-installing does not duplicate entries', () => {
    const once = withScryHooks({}, HOOKS);
    const twice = withScryHooks(once, HOOKS);
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });

  it('uninstall restores the file byte-for-byte minus our block', () => {
    const path = tempSettings({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-linter' }] },
        ],
      },
      otherSetting: true,
    });
    const before = readFileSync(path, 'utf8');

    installHooks(path, HOOKS);
    expect(isInstalled(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).not.toBe(before);

    uninstallHooks(path);
    expect(isInstalled(path)).toBe(false);
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('dry-run writes nothing', () => {
    const path = tempSettings({});
    const before = readFileSync(path, 'utf8');
    const result = installHooks(path, HOOKS, { dryRun: true });
    expect(result.changed).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(before);
  });
});

afterEach(() => {});
