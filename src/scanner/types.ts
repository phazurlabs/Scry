/**
 * Shared types for the scanner. Rules receive a fully pre-loaded SkillContext so
 * they never touch the filesystem themselves: every rule is a pure function of
 * its input, which is what makes the core deterministic and testable.
 */
import type { Finding, Severity } from '../report/schema.js';

export interface SkillFile {
  /** Path relative to the skill directory, POSIX separators. */
  path: string;
  /** Absolute path on disk. */
  abs: string;
  /** Decoded UTF-8 text, or '' when the file is binary. */
  content: string;
  /** content split into lines, for cheap line-number lookup. */
  lines: string[];
  /** True when the bytes failed UTF-8 / contained NUL — treated as opaque. */
  isBinary: boolean;
  /** Size in bytes. */
  size: number;
  /** Lowercased extension including the dot, e.g. ".sh" (or '' if none). */
  ext: string;
}

/** Optional per-skill allow manifest (scry.allow / scry.allow.json). */
export interface AllowManifest {
  /** Domains the skill is permitted to contact. */
  domains: string[];
}

/** Parsed SKILL.md YAML frontmatter (only the fields we care about). */
export interface Frontmatter {
  name: string | null;
  description: string | null;
  version: string | null;
  /** Raw key/value pairs for rules that want to inspect more. */
  raw: Record<string, string>;
}

export interface SkillContext {
  /** Absolute path to the skill directory. */
  dir: string;
  /** Best-effort skill name (frontmatter name, else directory name). */
  name: string;
  /** Every readable file in the skill, sorted by path. */
  files: SkillFile[];
  /** Parsed SKILL.md frontmatter, or null when absent/unparseable. */
  frontmatter: Frontmatter | null;
  /** Parsed allow manifest, or null when absent. */
  manifest: AllowManifest | null;
}

export interface Rule {
  id: string;
  severity: Severity;
  threatClass: string;
  title: string;
  check(ctx: SkillContext): Finding[];
}

/** Extensions we treat as executable/scriptable source. */
export const SCRIPT_EXTS = new Set([
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.rb',
  '.pl',
  '.php',
]);

export function isScript(file: SkillFile): boolean {
  return SCRIPT_EXTS.has(file.ext);
}
