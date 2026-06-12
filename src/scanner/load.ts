/**
 * Loads a skill directory into an in-memory SkillContext. This is the only place
 * the scanner touches the filesystem; rules operate purely on what we load here.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, type Dirent } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

import { parseFrontmatter } from './parsers/frontmatter.js';
import { parseManifest } from './parsers/manifest.js';
import type { SkillContext, SkillFile } from './types.js';

/** Directories we never descend into — noise, not skill payload. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.scry', '__pycache__']);

/** Files larger than this are recorded but their content is not loaded. */
const MAX_LOAD_BYTES = 2 * 1024 * 1024;

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

function looksBinary(buf: Buffer): boolean {
  // A NUL byte in the first 8KB is our binary signal — cheap and reliable.
  const slice = buf.subarray(0, 8192);
  return slice.includes(0);
}

function walk(dir: string, root: string, out: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), root, out);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      out.push(join(dir, entry.name));
    }
  }
}

function loadFile(abs: string, root: string): SkillFile {
  const rel = toPosix(relative(root, abs));
  const size = statSync(abs).size;
  const ext = extname(abs).toLowerCase();

  if (size > MAX_LOAD_BYTES) {
    return { path: rel, abs, content: '', lines: [], isBinary: true, size, ext };
  }

  const buf = readFileSync(abs);
  if (looksBinary(buf)) {
    return { path: rel, abs, content: '', lines: [], isBinary: true, size, ext };
  }
  const content = buf.toString('utf8');
  return {
    path: rel,
    abs,
    content,
    lines: content.split(/\r?\n/),
    isBinary: false,
    size,
    ext,
  };
}

/** Read a skill directory into a SkillContext. Throws only on unreadable root. */
export function loadSkill(dir: string): SkillContext {
  const absPaths: string[] = [];
  walk(dir, dir, absPaths);
  const files = absPaths
    .map((p) => loadFile(p, dir))
    .sort((a, b) => a.path.localeCompare(b.path));

  const skillMd = files.find((f) => f.path.toLowerCase() === 'skill.md');
  const frontmatter = skillMd ? parseFrontmatter(skillMd.content) : null;
  const manifest = parseManifest(files);

  const name = frontmatter?.name || dir.split(sep).filter(Boolean).pop() || 'unknown';

  return { dir, name, files, frontmatter, manifest };
}

/**
 * Deterministic content hash over the whole skill: sha256 of each file's
 * `relpath\0sha256(bytes)`, joined in sorted path order. Binary files included
 * by their byte hash. Identical input → identical hash, always.
 */
export function hashSkill(dir: string): string {
  const absPaths: string[] = [];
  walk(dir, dir, absPaths);
  absPaths.sort((a, b) => relative(dir, a).localeCompare(relative(dir, b)));

  const top = createHash('sha256');
  for (const abs of absPaths) {
    const rel = toPosix(relative(dir, abs));
    let bytes: Buffer;
    try {
      bytes = readFileSync(abs);
    } catch {
      continue;
    }
    const fileHash = createHash('sha256').update(bytes).digest('hex');
    top.update(rel).update('\0').update(fileHash).update('\n');
  }
  return top.digest('hex');
}
