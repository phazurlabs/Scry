/**
 * Resolves the locations Scry reads and writes: skills directories, the lock
 * file, and the settings.json that hooks are installed into. Everything is
 * overridable by environment variable so tests (and unusual setups) never have
 * to touch a real home directory.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ScryPaths {
  /** Directories that may contain installed skills (only existing ones). */
  skillsDirs: string[];
  /** settings.json the hooks are merged into. */
  settingsPath: string;
  /** The .scry working directory. */
  scryDir: string;
  /** .scry/lock.json */
  lockPath: string;
}

export interface PathOptions {
  cwd?: string;
  home?: string;
  /** Explicit skills dirs (overrides discovery). */
  skillsDirs?: string[];
  settingsPath?: string;
}

function fromEnvList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(':')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolvePaths(opts: PathOptions = {}): ScryPaths {
  const cwd = opts.cwd ?? process.cwd();
  const home = opts.home ?? process.env.SCRY_HOME ?? homedir();

  const candidates = opts.skillsDirs ??
    fromEnvList(process.env.SCRY_SKILLS_DIRS) ?? [
      join(home, '.claude', 'skills'),
      join(cwd, '.claude', 'skills'),
    ];

  const skillsDirs = candidates.filter((d) => existsSync(d));

  const settingsPath =
    opts.settingsPath ??
    process.env.SCRY_SETTINGS ??
    join(cwd, '.claude', 'settings.json');

  const scryDir = join(cwd, '.scry');
  return { skillsDirs, settingsPath, scryDir, lockPath: join(scryDir, 'lock.json') };
}

/** A discovered skill: its name and absolute directory. */
export interface DiscoveredSkill {
  name: string;
  dir: string;
}

/** List every skill directory (one containing a SKILL.md) under the given dirs. */
export function discoverSkills(skillsDirs: string[]): DiscoveredSkill[] {
  const found: DiscoveredSkill[] = [];
  const seen = new Set<string>();
  for (const base of skillsDirs) {
    let entries: string[];
    try {
      entries = readdirSync(base);
    } catch {
      continue;
    }
    for (const name of entries.sort()) {
      const dir = join(base, name);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      if (!existsSync(join(dir, 'SKILL.md'))) continue;
      if (seen.has(dir)) continue;
      seen.add(dir);
      found.push({ name, dir });
    }
  }
  return found;
}
