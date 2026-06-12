/**
 * Installs (and removes) Scry's hook entries in a Claude Code settings.json.
 *
 * Design constraints that matter:
 *  - Merge, never clobber: existing hooks from the user or other tools are
 *    preserved untouched.
 *  - Idempotent: re-installing replaces our entries rather than duplicating them.
 *  - Cleanly removable: uninstall deletes exactly our entries, and any container
 *    (event array, hooks object) we emptied, restoring the file byte-for-byte
 *    minus our block.
 *
 * Our entries are recognized solely by the hook script filename in the command
 * (pretooluse.js / posttooluse.js), so detection needs no extra metadata.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRE = 'pretooluse.js';
const POST = 'posttooluse.js';
const STATUS = 'Scry: discernment check';

interface HookHandler {
  type: 'command';
  command: string;
  timeout?: number;
  statusMessage?: string;
}

interface HookGroup {
  matcher?: string;
  hooks: HookHandler[];
}

type Settings = Record<string, unknown> & {
  hooks?: Record<string, HookGroup[]>;
};

/** Absolute path to the compiled hooks directory shipped in dist/. */
export function defaultHooksDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'hooks');
}

function command(scriptAbs: string): string {
  return `node "${scriptAbs}"`;
}

function isScryCommand(cmd: string): boolean {
  return cmd.includes(PRE) || cmd.includes(POST);
}

function isScryGroup(group: HookGroup): boolean {
  // Defensive: a user or other tool may have written a malformed group. Anything
  // that isn't a well-formed array of command hooks simply isn't ours.
  const hooks = (group as { hooks?: unknown })?.hooks;
  return (
    Array.isArray(hooks) &&
    hooks.some((h) => typeof h?.command === 'string' && isScryCommand(h.command))
  );
}

/**
 * Return the `hooks` object from settings, or undefined when absent. Throws a
 * clear, actionable error when `hooks` is present but the wrong shape, so the
 * installer never crashes with a raw TypeError on otherwise-recoverable data.
 */
function hooksMap(
  settings: Settings,
  verb: string,
): Record<string, HookGroup[]> | undefined {
  const h = settings.hooks as unknown;
  if (h === undefined) return undefined;
  if (h === null || typeof h !== 'object' || Array.isArray(h)) {
    throw new Error(`settings.json "hooks" must be an object; refusing to ${verb} it`);
  }
  return h as Record<string, HookGroup[]>;
}

/** The three event groups Scry installs, pointing at the given hooks dir. */
export function scryBlock(hooksDir: string): Record<string, HookGroup> {
  const pre = command(join(hooksDir, PRE));
  const post = command(join(hooksDir, POST));
  return {
    PreToolUse: {
      matcher: 'Bash',
      hooks: [{ type: 'command', command: pre, timeout: 30, statusMessage: STATUS }],
    },
    PostToolUse: {
      matcher: 'Write|Edit',
      hooks: [{ type: 'command', command: post, timeout: 30, statusMessage: STATUS }],
    },
    SessionStart: {
      matcher: 'startup|resume|clear',
      hooks: [{ type: 'command', command: post, timeout: 30, statusMessage: STATUS }],
    },
  };
}

function readSettings(settingsPath: string): Settings {
  if (!existsSync(settingsPath)) return {};
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8')) as Settings;
  } catch {
    // Refuse to silently overwrite a file we cannot parse.
    throw new Error(
      `settings.json at ${settingsPath} is not valid JSON; refusing to modify it`,
    );
  }
}

function serialize(settings: Settings): string {
  return JSON.stringify(settings, null, 2) + '\n';
}

/** Remove every Scry group from a settings object, pruning emptied containers. */
function stripScry(settings: Settings, verb = 'modify'): Settings {
  const hooks = hooksMap(settings, verb);
  if (!hooks) return settings;
  for (const event of Object.keys(hooks)) {
    const groups = hooks[event];
    if (!Array.isArray(groups)) continue; // leave non-array values untouched
    const kept = groups.filter((g) => !isScryGroup(g));
    if (kept.length === 0) delete hooks[event];
    else hooks[event] = kept;
  }
  if (Object.keys(hooks).length === 0) delete settings.hooks;
  return settings;
}

/** Produce the settings object with Scry's block merged in (pure). */
export function withScryHooks(settings: Settings, hooksDir: string): Settings {
  const next = stripScry(structuredClone(settings), 'install');
  const block = scryBlock(hooksDir);
  next.hooks ??= {};
  for (const [event, group] of Object.entries(block)) {
    const existing = next.hooks[event];
    if (existing !== undefined && !Array.isArray(existing)) {
      throw new Error(
        `settings.json hooks.${event} must be an array; refusing to modify it`,
      );
    }
    next.hooks[event] ??= [];
    next.hooks[event].push(group);
  }
  return next;
}

export interface InstallResult {
  before: string;
  after: string;
  changed: boolean;
}

/** Install hooks. With dryRun the file is not written; the diff is returned. */
export function installHooks(
  settingsPath: string,
  hooksDir = defaultHooksDir(),
  opts: { dryRun?: boolean } = {},
): InstallResult {
  const current = readSettings(settingsPath);
  const before = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : '';
  const merged = withScryHooks(current, hooksDir);
  // Idempotent no-op: our block is already present and merging changed nothing,
  // so leave the file (and its existing formatting) exactly as it is.
  if (JSON.stringify(current) === JSON.stringify(merged)) {
    return { before, after: before, changed: false };
  }
  const after = serialize(merged);
  const changed = before !== after;
  if (!opts.dryRun && changed) {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, after);
  }
  return { before, after, changed };
}

/** Remove Scry hooks, restoring the file to its pre-install bytes. */
export function uninstallHooks(settingsPath: string): InstallResult {
  if (!existsSync(settingsPath)) return { before: '', after: '', changed: false };
  const current = readSettings(settingsPath);
  const before = readFileSync(settingsPath, 'utf8');
  const stripped = stripScry(structuredClone(current), 'clean');
  // If nothing but our block existed, the object may now be empty {}.
  const after = serialize(stripped);
  const changed = before !== after;
  if (changed) writeFileSync(settingsPath, after);
  return { before, after, changed };
}

/** True when Scry hooks are present in the settings file. */
export function isInstalled(settingsPath: string): boolean {
  const settings = readSettings(settingsPath);
  const hooks = settings.hooks;
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return false;
  return Object.values(hooks).some(
    (groups) => Array.isArray(groups) && groups.some((g) => isScryGroup(g)),
  );
}
