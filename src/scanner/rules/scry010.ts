/**
 * SCRY010 · info · Provenance gaps.
 *
 * Threat class: OWASP Top 10 for Agentic Applications 2026 — ASI09 Insufficient
 * Transparency / ASI08 Supply Chain. OWASP Agentic Skills Top 10: "Missing
 * Provenance". You cannot assess trust in code you cannot trace: no license, no
 * source repository, and no version make a skill unaccountable. Informational.
 *
 * SHOULD catch:
 *   a skill with no LICENSE file and no version field
 *   a skill with no repository/source URL anywhere
 * MUST NOT catch (near-miss):
 *   a skill with a LICENSE, a version in frontmatter, and a repo URL in README
 *   a skill whose SKILL.md frontmatter declares version and homepage
 */
import type { Finding } from '../../report/schema.js';
import type { Rule, SkillContext } from '../types.js';
import { skillFinding } from '../util.js';

const LICENSE_NAMES = /^(license|licence|copying)(\.|$)/i;
const REPO_URL = /\b(github\.com|gitlab\.com|bitbucket\.org|https?:\/\/[^\s)]+)\b/i;

export const rule: Rule = {
  id: 'SCRY010',
  severity: 'info',
  threatClass:
    'OWASP Agentic Apps 2026 ASI09/ASI08 / Agentic Skills Top 10: Missing Provenance',
  title: 'Provenance gaps',

  check(ctx: SkillContext): Finding[] {
    const findings: Finding[] = [];

    const hasLicense = ctx.files.some((f) =>
      LICENSE_NAMES.test(f.path.split('/').pop() ?? ''),
    );
    if (!hasLicense) {
      findings.push(
        skillFinding(
          this,
          '.',
          '(no LICENSE)',
          'Skill has no license file.',
          'Add a LICENSE file declaring usage terms.',
        ),
      );
    }

    const version = ctx.frontmatter?.version?.trim();
    if (!version) {
      findings.push(
        skillFinding(
          this,
          'SKILL.md',
          '(no version)',
          'Skill declares no version, so changes cannot be tracked.',
          'Add a version field to SKILL.md frontmatter.',
        ),
      );
    }

    // A source/repository URL anywhere (frontmatter values or any text file).
    const fmText = Object.values(ctx.frontmatter?.raw ?? {}).join(' ');
    const textBlob =
      fmText +
      ' ' +
      ctx.files
        .filter(
          (f) =>
            !f.isBinary && (f.ext === '.md' || f.ext === '.markdown' || f.ext === '.txt'),
        )
        .map((f) => f.content)
        .join(' ');
    if (!REPO_URL.test(textBlob)) {
      findings.push(
        skillFinding(
          this,
          '.',
          '(no source URL)',
          'Skill provides no repository or source URL, so its origin cannot be verified.',
          'Add a repository/homepage URL to SKILL.md or the README.',
        ),
      );
    }

    return findings;
  },
};

export default rule;
