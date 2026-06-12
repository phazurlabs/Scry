/**
 * Shared plumbing for the hook handlers: read the JSON event from stdin, and
 * work out which installed skill (if any) a tool action touches.
 *
 * Every function here is defensive. Hooks run inside someone's editing session,
 * so the cardinal rule is fail-open: if anything is malformed or unexpected, we
 * return null/empty and let the normal permission flow proceed.
 */
import { resolvePaths, discoverSkills, type DiscoveredSkill } from '../paths.js';

export interface HookInput {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
  source?: string;
}

/** Read all of stdin and JSON-parse it. Returns null on any failure. */
export async function readHookInput(): Promise<HookInput | null> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8').trim();
    if (!text) return null;
    return JSON.parse(text) as HookInput;
  } catch {
    return null;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The text fields of a tool call that could reference a skill path. */
function actionText(input: HookInput): string {
  const ti = input.tool_input ?? {};
  const parts: string[] = [];
  for (const key of ['command', 'file_path', 'path', 'cwd', 'notebook_path']) {
    const v = ti[key];
    if (typeof v === 'string') parts.push(v);
  }
  return parts.join('\n');
}

/**
 * Resolve which installed skill a tool action refers to, or null. A skill
 * matches when its absolute directory appears in the action, or the action
 * references `skills/<name>/`. The most specific (longest dir) match wins.
 */
export function resolveSkill(input: HookInput): DiscoveredSkill | null {
  const paths = resolvePaths({ cwd: input.cwd });
  const skills = discoverSkills(paths.skillsDirs);
  const text = actionText(input);
  if (!text) return null;

  let best: DiscoveredSkill | null = null;
  for (const skill of skills) {
    if ((matchesDir(text, skill.dir) || matchesName(text, skill.name)) === false)
      continue;
    if (!best || skill.dir.length > best.dir.length) best = skill;
  }
  return best;
}

/**
 * The skill's absolute dir appears in the action, followed by a path boundary.
 * The boundary check prevents `/skills/foo` from matching a sibling like
 * `/skills/foo.backup` or `/skills/foo-bar`, which would mis-resolve the skill.
 */
function matchesDir(text: string, dir: string): boolean {
  let from = 0;
  for (;;) {
    const idx = text.indexOf(dir, from);
    if (idx < 0) return false;
    const after = text[idx + dir.length];
    if (
      after === undefined ||
      after === '/' ||
      after === '"' ||
      after === "'" ||
      /\s/.test(after)
    ) {
      return true;
    }
    from = idx + 1;
  }
}

/** The action references `skills/<name>/` (or name at a boundary). */
function matchesName(text: string, name: string): boolean {
  return new RegExp(`skills/${escapeRegex(name)}(/|["'\\s]|$)`).test(text);
}
