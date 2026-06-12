/**
 * SCRY007 · warn · Unpinned remote execution.
 *
 * Threat class: OWASP Top 10 for Agentic Applications 2026 — ASI08 Supply Chain
 * & Dependency Risk. OWASP Agentic Skills Top 10: "Unpinned Dependencies".
 * Fetching @latest, installing unpinned packages, or cloning a moving branch at
 * runtime means the code that actually runs can change after a review passes.
 *
 * SHOULD catch:
 *   npx some-tool@latest
 *   pip install requests           (no version pin)
 * MUST NOT catch (near-miss):
 *   npx some-tool@1.4.2            (pinned)
 *   pip install -r requirements.txt (resolved from a pinned file)
 */
import type { Finding } from '../../report/schema.js';
import type { Rule, SkillContext } from '../types.js';
import { isScript } from '../types.js';
import { dequote, finding, stripComment } from '../util.js';

interface Pat {
  re: RegExp;
  explanation: string;
  remediation: string;
}

const PATTERNS: Pat[] = [
  {
    re: /\bnpx\s+(-y\s+|--yes\s+)?\S+@latest\b/,
    explanation:
      'npx fetches and runs the @latest version, which can change at any time.',
    remediation: 'Pin to an exact version, e.g. npx tool@1.2.3.',
  },
  {
    re: /\bnpm\s+(install|i|exec)\s+\S*@latest\b/,
    explanation: 'npm installs the @latest version, which is unpinned.',
    remediation: 'Pin to an exact version.',
  },
  {
    // pip install <pkg> with no version operator, not -r/-e/local path/URL.
    re: /\bpip3?\s+install\s+(?!-r\b)(?!-e\b)(?!--requirement\b)(?![./])(?!git\+)(?!https?:)(?![^\n]*[=<>~!])[A-Za-z][\w.-]*/,
    explanation: 'pip installs an unpinned package; the resolved version can change.',
    remediation:
      'Pin the version, e.g. pip install pkg==1.2.3, or use a pinned requirements file.',
  },
  {
    re: /\bgit\s+clone\b/,
    explanation: 'A git clone at runtime tracks a moving branch by default.',
    remediation:
      'Vendor the dependency or check out a pinned tag/commit instead of cloning at runtime.',
  },
  {
    re: /\bcurl\b[^\n]*\bget(\.pnpm\.io|\.rvm\.io|\.sdkman\.io)\b/,
    explanation: 'A remote bootstrap installer is fetched at runtime.',
    remediation: 'Use a pinned, vendored installer.',
  },
];

export const rule: Rule = {
  id: 'SCRY007',
  severity: 'warn',
  threatClass:
    'OWASP Agentic Apps 2026 ASI08 / Agentic Skills Top 10: Unpinned Dependencies',
  title: 'Unpinned remote execution',

  check(ctx: SkillContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of ctx.files) {
      if (file.isBinary || !isScript(file)) continue;
      for (let i = 0; i < file.lines.length; i++) {
        // Strip comments AND string literals: a `pip install` inside a quoted
        // string (help text, docstring) is not an actual install command.
        const code = dequote(stripComment(file.lines[i] ?? ''));
        const hit = { file, line: i + 1, text: file.lines[i] ?? '' };
        for (const p of PATTERNS) {
          p.re.lastIndex = 0;
          if (p.re.test(code)) {
            findings.push(finding(this, hit, p.explanation, p.remediation));
            break;
          }
        }
      }
    }
    return findings;
  },
};

export default rule;
