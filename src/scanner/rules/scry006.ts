/**
 * SCRY006 · warn · Self-modification reach.
 *
 * Threat class: OWASP Top 10 for Agentic Applications 2026 — ASI05 Insecure
 * Configuration / ASI04 Unsafe Tool Use. OWASP Agentic Skills Top 10:
 * "Configuration Tampering". A skill that writes to Claude Code settings, hook
 * files, other skills, or anywhere outside its own directory can grant itself
 * persistence or disable the very protections meant to contain it.
 *
 * SHOULD catch:
 *   echo '{...}' > ~/.claude/settings.json
 *   cp payload.sh ../other-skill/run.sh
 * MUST NOT catch (near-miss):
 *   echo "done" > ./output/log.txt     (writes inside the skill)
 *   cat ./reference/notes.md           (read inside the skill)
 */
import type { Finding } from '../../report/schema.js';
import { escapesSkillDir, tokenize } from '../parsers/shell.js';
import type { Rule, SkillContext } from '../types.js';
import { isScript } from '../types.js';
import { finding, stripComment } from '../util.js';

const CLAUDE_SURFACE: Array<{ re: RegExp; explanation: string }> = [
  {
    re: /\.claude\/settings(\.local)?\.json/,
    explanation: 'Script references the Claude Code settings file.',
  },
  {
    re: /\.claude\/hooks\b/,
    explanation: 'Script references the Claude Code hooks directory.',
  },
  {
    re: /\.claude\/skills\/(?!\s*$)/,
    explanation: 'Script reaches into the skills directory, potentially other skills.',
  },
];

/**
 * Innocuous write sinks. Writing to /dev/null (or other /dev, /proc pseudo-files)
 * is not self-modification — it is how scripts discard output (e.g. `> /dev/null`).
 */
function isInnocuousSink(target: string): boolean {
  const t = target.replace(/^["']|["']$/g, '');
  return t.startsWith('/dev/') || t.startsWith('/proc/');
}

/** Find a write-redirection (> / >>) whose target escapes the skill directory. */
function redirectEscapes(code: string): boolean {
  const tokens = tokenize(code);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? '';
    if (tok === '>' || tok === '>>') {
      const target = tokens[i + 1] ?? '';
      if (target && !isInnocuousSink(target) && escapesSkillDir(target)) return true;
    }
    // Handle "echo x >/abs/path" where redirection is glued to the path.
    const glued = /^>>?(\S+)$/.exec(tok);
    const gluedTarget = glued?.[1] ?? '';
    if (gluedTarget && !isInnocuousSink(gluedTarget) && escapesSkillDir(gluedTarget))
      return true;
  }
  return false;
}

const TEE_ESCAPE = /\btee\s+(-a\s+)?(\/|~|\$HOME)/;

/** Find cp/mv/rsync/install/ln whose destination escapes the skill directory. */
function copyEscapes(code: string): boolean {
  const tokens = tokenize(code);
  const head = (tokens[0] ?? '').replace(/^.*\//, '');
  if (!['cp', 'mv', 'rsync', 'install', 'ln'].includes(head)) return false;
  const operands = tokens.slice(1).filter((t) => !t.startsWith('-'));
  const dest = operands[operands.length - 1];
  return dest !== undefined && escapesSkillDir(dest);
}

export const rule: Rule = {
  id: 'SCRY006',
  severity: 'warn',
  threatClass:
    'OWASP Agentic Apps 2026 ASI05/ASI04 / Agentic Skills Top 10: Configuration Tampering',
  title: 'Self-modification beyond the skill directory',

  check(ctx: SkillContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of ctx.files) {
      if (file.isBinary || !isScript(file)) continue;
      for (let i = 0; i < file.lines.length; i++) {
        const code = stripComment(file.lines[i] ?? '');
        const hit = { file, line: i + 1, text: file.lines[i] ?? '' };

        let matched = false;
        for (const s of CLAUDE_SURFACE) {
          s.re.lastIndex = 0;
          if (s.re.test(code)) {
            findings.push(
              finding(
                this,
                hit,
                s.explanation,
                'A skill should only read and write inside its own directory.',
              ),
            );
            matched = true;
            break;
          }
        }
        if (matched) continue;

        if (redirectEscapes(code) || TEE_ESCAPE.test(code) || copyEscapes(code)) {
          findings.push(
            finding(
              this,
              hit,
              'Script writes to a path outside the skill’s own directory.',
              'Confine writes to the skill directory; do not modify the wider filesystem.',
            ),
          );
        }
      }
    }
    return findings;
  },
};

export default rule;
