/**
 * Reader for an optional per-skill allow manifest. A skill author can declare the
 * domains their bundled scripts legitimately contact, turning SCRY001 network
 * findings on those domains into expected behavior rather than a block.
 *
 * Two accepted forms (first found wins), both at the skill root:
 *   - scry.allow.json : { "domains": ["api.example.com"] }
 *   - scry.allow      : newline-separated domains, '#' comments allowed
 */
import type { AllowManifest, SkillFile } from '../types.js';

const MANIFEST_NAMES = new Set(['scry.allow.json', 'scry.allow']);

export function isManifestFile(relPath: string): boolean {
  return MANIFEST_NAMES.has(relPath);
}

function normalizeDomain(d: string): string {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
}

export function parseManifest(files: SkillFile[]): AllowManifest | null {
  const json = files.find((f) => f.path === 'scry.allow.json');
  if (json) {
    try {
      const data = JSON.parse(json.content) as { domains?: unknown };
      const domains = Array.isArray(data.domains)
        ? data.domains.filter((d): d is string => typeof d === 'string')
        : [];
      return { domains: domains.map(normalizeDomain).filter(Boolean) };
    } catch {
      // Malformed manifest is treated as "no manifest"; SCRY008 covers integrity.
      return { domains: [] };
    }
  }

  const flat = files.find((f) => f.path === 'scry.allow');
  if (flat) {
    const domains = flat.content
      .split(/\r?\n/)
      .map((l) => l.replace(/#.*$/, ''))
      .map(normalizeDomain)
      .filter(Boolean);
    return { domains };
  }

  return null;
}

/** True when `host` equals an allowed domain or is a subdomain of one. */
export function domainAllowed(host: string, manifest: AllowManifest | null): boolean {
  if (!manifest) return false;
  const h = normalizeDomain(host);
  return manifest.domains.some((d) => h === d || h.endsWith('.' + d));
}
