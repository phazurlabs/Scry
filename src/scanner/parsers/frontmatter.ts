/**
 * Minimal YAML frontmatter reader. We only need top-level scalar keys from a
 * SKILL.md header (name, description, version), so we deliberately do NOT pull in
 * a full YAML parser — less surface area, fully deterministic, no dependency.
 */
import type { Frontmatter } from '../types.js';

const FENCE = /^---\s*$/;

/** Extract the raw frontmatter block text from a markdown document, or null. */
export function extractFrontmatterBlock(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  if (lines.length === 0 || !FENCE.test(lines[0] ?? '')) return null;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i] ?? '')) {
      return lines.slice(1, i).join('\n');
    }
  }
  return null;
}

function unquote(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v.slice(1, -1);
  }
  return v;
}

/** Parse top-level `key: value` pairs from a SKILL.md document. */
export function parseFrontmatter(markdown: string): Frontmatter | null {
  const block = extractFrontmatterBlock(markdown);
  if (block === null) return null;

  const raw: Record<string, string> = {};
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.replace(/\t/g, '  ');
    // Only top-level keys (no indentation).
    const m = /^([A-Za-z0-9_-]+):\s?(.*)$/.exec(line);
    if (!m || /^\s/.test(rawLine)) continue;
    const key = (m[1] ?? '').toLowerCase();
    const value = (m[2] ?? '').trim();

    // YAML block scalar (| or >, with optional chomping +/-): gather the
    // following indented lines as the value. Without this, a multi-line
    // description reads as empty and trips SCRY008 falsely.
    if (/^[|>][+-]?$/.test(value)) {
      const collected: string[] = [];
      // The block continues through indented lines AND blank lines (blank lines
      // are legal inside a YAML block scalar); it ends only at the next
      // top-level key or end of block. Truncating at the first blank line would
      // silently drop later paragraphs of a description.
      while (i + 1 < lines.length) {
        const next = lines[i + 1] ?? '';
        if (next.trim() !== '' && !/^\s/.test(next)) break;
        collected.push((lines[++i] ?? '').trim());
      }
      raw[key] = collected.join(value.startsWith('>') ? ' ' : '\n').trim();
      continue;
    }
    raw[key] = unquote(value);
  }

  return {
    name: raw.name ?? null,
    description: raw.description ?? null,
    version: raw.version ?? null,
    raw,
  };
}
