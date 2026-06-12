/**
 * SCRY005 · warn · Obfuscation signals in bundled code.
 *
 * Threat class: OWASP Top 10 for Agentic Applications 2026 — ASI04 Unsafe Tool
 * Use / ASI08 Supply Chain. OWASP Agentic Skills Top 10: "Obfuscated Payload".
 * Legitimate skill code has nothing to hide; decode-then-exec, eval over
 * assembled strings, and zero-width characters are deception signals.
 *
 * SHOULD catch:
 *   eval(atob("Y3VybCBldmlsLmNvbQ=="))
 *   exec(base64.b64decode(payload))
 * MUST NOT catch (near-miss):
 *   base64 logo.png > logo.b64        (encode, no execution)
 *   const id = String.fromCharCode(65) (single char, not assembly)
 */
import type { Finding } from '../../report/schema.js';
import type { Rule, SkillContext } from '../types.js';
import { isScript } from '../types.js';
import { finding } from '../util.js';

interface Pat {
  re: RegExp;
  explanation: string;
}

const CODE_PATTERNS: Pat[] = [
  {
    re: /\beval\s*\(\s*(atob|Buffer\.from|unescape|decodeURIComponent|String\.fromCharCode)/i,
    explanation: 'eval() executes a decoded/assembled string rather than literal source.',
  },
  {
    re: /\bexec\s*\(\s*(base64\.b64decode|bytes\.fromhex|codecs\.decode|bytearray\.fromhex)/i,
    explanation: 'exec() runs bytes decoded at runtime, hiding the real payload.',
  },
  {
    re: /\bbase64\s+(-d|-D|--decode)\b[^|\n]*\|\s*(ba|z)?sh\b/,
    explanation: 'Base64 is decoded and piped straight into a shell.',
  },
  {
    re: /String\.fromCharCode\s*\(\s*\d+\s*(,\s*\d+\s*){3,}\)/,
    explanation:
      'A string is assembled from many character codes (charcode obfuscation).',
  },
  {
    re: /(\\x[0-9a-fA-F]{2}){8,}/,
    explanation: 'A long run of hex escapes assembles a hidden string.',
  },
  {
    re: /(chr\(\d+\)\s*\+\s*){3,}/,
    explanation: 'A string is concatenated from many chr() calls (charcode obfuscation).',
  },
];

// Zero-width / invisible characters that can hide instructions in markdown:
// U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+2060 word-joiner, U+FEFF BOM/ZWNBSP.
// Written as escapes so the pattern itself stays visible and auditable.
const ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\uFEFF]/;

export const rule: Rule = {
  id: 'SCRY005',
  severity: 'warn',
  threatClass:
    'OWASP Agentic Apps 2026 ASI04/ASI08 / Agentic Skills Top 10: Obfuscated Payload',
  title: 'Obfuscation signal in bundled code',

  check(ctx: SkillContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of ctx.files) {
      if (file.isBinary) continue;
      const scriptFile = isScript(file);
      const markdown = file.ext === '.md' || file.ext === '.markdown';

      for (let i = 0; i < file.lines.length; i++) {
        const text = file.lines[i] ?? '';
        const hit = { file, line: i + 1, text };

        if (scriptFile) {
          for (const p of CODE_PATTERNS) {
            p.re.lastIndex = 0;
            if (p.re.test(text)) {
              findings.push(
                finding(
                  this,
                  hit,
                  p.explanation,
                  'Replace obfuscated code with readable, auditable source.',
                ),
              );
              break;
            }
          }
        }

        if (markdown && ZERO_WIDTH.test(text)) {
          findings.push(
            finding(
              this,
              hit,
              'Markdown contains zero-width/invisible characters that can conceal hidden instructions.',
              'Strip zero-width characters from the document.',
            ),
          );
        }
      }
    }
    return findings;
  },
};

export default rule;
