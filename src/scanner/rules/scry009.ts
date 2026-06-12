/**
 * SCRY009 · info · Excessive scope.
 *
 * Threat class: OWASP Top 10 for Agentic Applications 2026 — ASI08 Supply Chain
 * / ASI09 Insufficient Transparency. OWASP Agentic Skills Top 10: "Excessive
 * Footprint". Shipped binaries, a large number of scripts, or an oversized
 * payload for a stated purpose all widen the attack surface and reduce
 * auditability. This is informational: surfaced, never blocking.
 *
 * SHOULD catch:
 *   a bundled compiled executable (./bin/agent, a .so/.dll/.exe)
 *   a skill that ships 30 separate shell scripts
 * MUST NOT catch (near-miss):
 *   a small PNG icon (binary, but not an executable)
 *   a skill with two scripts and a README
 */
import type { Finding } from '../../report/schema.js';
import type { Rule, SkillContext } from '../types.js';
import { isScript } from '../types.js';
import { skillFinding } from '../util.js';

const EXECUTABLE_EXTS = new Set([
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.o',
  '.a',
  '.wasm',
]);
const MAX_SCRIPTS = 20;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

export const rule: Rule = {
  id: 'SCRY009',
  severity: 'info',
  threatClass:
    'OWASP Agentic Apps 2026 ASI08/ASI09 / Agentic Skills Top 10: Excessive Footprint',
  title: 'Excessive scope for a skill',

  check(ctx: SkillContext): Finding[] {
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      if (EXECUTABLE_EXTS.has(file.ext)) {
        findings.push(
          skillFinding(
            this,
            file.path,
            `(${file.size} bytes, ${file.ext})`,
            'Skill ships a compiled binary/executable, which cannot be statically reviewed.',
            'Distribute auditable source instead of a prebuilt binary, or justify the binary in the README.',
          ),
        );
      }
    }

    const scriptCount = ctx.files.filter((f) => isScript(f)).length;
    if (scriptCount > MAX_SCRIPTS) {
      findings.push(
        skillFinding(
          this,
          '.',
          `${scriptCount} scripts`,
          `Skill bundles ${scriptCount} scripts (> ${MAX_SCRIPTS}), an unusually large footprint.`,
          'Consolidate or remove scripts the skill does not need.',
        ),
      );
    }

    const totalBytes = ctx.files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      findings.push(
        skillFinding(
          this,
          '.',
          `${totalBytes} bytes total`,
          `Skill payload is ${(totalBytes / 1024 / 1024).toFixed(1)}MB, large for a skill.`,
          'Trim bundled assets to what the skill actually needs.',
        ),
      );
    }

    return findings;
  },
};

export default rule;
