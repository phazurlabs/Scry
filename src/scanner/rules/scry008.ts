/**
 * SCRY008 · warn · Frontmatter / manifest integrity.
 *
 * Threat class: OWASP Top 10 for Agentic Applications 2026 — ASI09 Insufficient
 * Transparency / ASI01 Instruction Injection. OWASP Agentic Skills Top 10:
 * "Capability Misrepresentation". A skill whose stated purpose does not match
 * what its code actually does is either broken or deceptive; the agent decides
 * to invoke a skill based on its description.
 *
 * The mismatch check is a deterministic heuristic only: if the bundled scripts
 * make network calls but the description never mentions any network behavior,
 * flag it. No semantic/LLM judgment.
 *
 * SHOULD catch:
 *   (SKILL.md with no description field at all)
 *   description: "Formats local CSV files"  +  a script that calls requests.post
 * MUST NOT catch (near-miss):
 *   description: "Downloads release notes from the GitHub API" + a network script
 *   a well-formed name + description with no network code anywhere
 */
import type { Finding } from '../../report/schema.js';
import { isLoopback, isNetworkCall } from '../signals.js';
import type { Rule, SkillContext } from '../types.js';
import { isScript } from '../types.js';
import { skillFinding } from '../util.js';

const NETWORK_WORDS =
  /\b(network|http|https|url|fetch|download|upload|api|request|remote|internet|online|web|endpoint|server|sync|webhook)\b/i;

export const rule: Rule = {
  id: 'SCRY008',
  severity: 'warn',
  threatClass:
    'OWASP Agentic Apps 2026 ASI09/ASI01 / Agentic Skills Top 10: Capability Misrepresentation',
  title: 'Frontmatter or manifest integrity',

  check(ctx: SkillContext): Finding[] {
    const findings: Finding[] = [];
    const fm = ctx.frontmatter;

    if (!fm) {
      findings.push(
        skillFinding(
          this,
          'SKILL.md',
          '(missing frontmatter)',
          'SKILL.md has no parseable YAML frontmatter, so its name and description are undeclared.',
          'Add a frontmatter block with name and description fields.',
        ),
      );
      return findings; // nothing else to check without frontmatter
    }

    if (!fm.name || fm.name.trim().length === 0) {
      findings.push(
        skillFinding(
          this,
          'SKILL.md',
          'name:',
          'SKILL.md frontmatter is missing a name field.',
          'Add a name field.',
        ),
      );
    }
    const desc = fm.description?.trim() ?? '';
    if (desc.length < 8) {
      findings.push(
        skillFinding(
          this,
          'SKILL.md',
          'description:',
          'SKILL.md frontmatter has a missing or too-short description.',
          'Add a clear description of what the skill does.',
        ),
      );
    }

    // Deterministic mismatch heuristic: network behavior absent from description.
    // Loopback-only calls (local test servers) don't count as network behavior.
    const hasNetworkCode = ctx.files.some(
      (f) =>
        !f.isBinary &&
        isScript(f) &&
        f.lines.some((l) => isNetworkCall(l, f.ext) && !isLoopback(l)),
    );
    if (hasNetworkCode && desc.length >= 8 && !NETWORK_WORDS.test(desc)) {
      findings.push(
        skillFinding(
          this,
          'SKILL.md',
          desc,
          'Bundled scripts make network calls, but the description never mentions any network behavior.',
          'Update the description to disclose the network behavior, or remove the network calls.',
        ),
      );
    }

    return findings;
  },
};

export default rule;
