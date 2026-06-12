/**
 * Test helpers: build in-memory SkillContexts so rule tests can assert against
 * exact crafted lines (the "should catch / must not catch" cases) without
 * touching the filesystem.
 */
import { extname } from 'node:path';

import { parseFrontmatter } from '../src/scanner/parsers/frontmatter.js';
import { parseManifest } from '../src/scanner/parsers/manifest.js';
import type { SkillContext, SkillFile } from '../src/scanner/types.js';

export function fileFrom(path: string, content: string): SkillFile {
  return {
    path,
    abs: '/virtual/' + path,
    content,
    lines: content.split(/\r?\n/),
    isBinary: false,
    size: Buffer.byteLength(content),
    ext: extname(path).toLowerCase(),
  };
}

export interface CtxInput {
  path: string;
  content: string;
}

export function ctxFrom(inputs: CtxInput[], name = 'test-skill'): SkillContext {
  const files = inputs
    .map((i) => fileFrom(i.path, i.content))
    .sort((a, b) => a.path.localeCompare(b.path));
  const skillMd = files.find((f) => f.path.toLowerCase() === 'skill.md');
  const frontmatter = skillMd ? parseFrontmatter(skillMd.content) : null;
  const manifest = parseManifest(files);
  return {
    dir: '/virtual',
    name: frontmatter?.name || name,
    files,
    frontmatter,
    manifest,
  };
}

/** Convenience: a single script file context. */
export function scriptCtx(path: string, content: string): SkillContext {
  return ctxFrom([{ path, content }]);
}
