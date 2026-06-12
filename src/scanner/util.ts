/**
 * Small shared helpers for rules. Kept deliberately boring: a rule author should
 * be able to read this file in one pass and trust exactly what it does.
 */
import type { Finding, Severity } from '../report/schema.js';
import type { Rule, SkillFile } from './types.js';

const MAX_SNIPPET = 160;

/** Trim a matched line to a stable, display-friendly snippet. */
export function snippet(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_SNIPPET ? trimmed.slice(0, MAX_SNIPPET) + '…' : trimmed;
}

export interface MatchHit {
  file: SkillFile;
  /** 1-based line number. */
  line: number;
  text: string;
}

/**
 * Run a regex against every line of a file and yield each hit. The regex is
 * reset per line so callers may pass a /g pattern without state leaking.
 */
export function matchLines(file: SkillFile, pattern: RegExp): MatchHit[] {
  const hits: MatchHit[] = [];
  for (let i = 0; i < file.lines.length; i++) {
    const text = file.lines[i] ?? '';
    if (test(pattern, text)) hits.push({ file, line: i + 1, text });
  }
  return hits;
}

/** Stateless regex test (clears lastIndex for global patterns). */
export function test(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

/** Build a Finding from a rule + a line hit, reading title/severity from the rule. */
export function finding(
  rule: Pick<Rule, 'id' | 'severity' | 'threatClass' | 'title'>,
  hit: { file: SkillFile; line: number; text: string },
  explanation: string,
  remediation: string,
  severityOverride?: Severity,
): Finding {
  return {
    ruleId: rule.id,
    severity: severityOverride ?? rule.severity,
    threatClass: rule.threatClass,
    title: rule.title,
    file: hit.file.path,
    line: hit.line,
    snippet: snippet(hit.text),
    explanation,
    remediation,
  };
}

/** A whole-skill finding not tied to a specific line (line = 0). */
export function skillFinding(
  rule: Pick<Rule, 'id' | 'severity' | 'threatClass' | 'title'>,
  file: string,
  text: string,
  explanation: string,
  remediation: string,
): Finding {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    threatClass: rule.threatClass,
    title: rule.title,
    file,
    line: 0,
    snippet: snippet(text),
    explanation,
    remediation,
  };
}

/**
 * Remove quoted/backticked spans from a line. Used to avoid matching a command
 * pattern that only appears inside a string literal — e.g. a notebook linter's
 * help text `"pip install detect-secrets"` is documentation, not a command.
 *
 * `includeSingle` controls single-quote stripping. Code rules want it (shell and
 * Python use `'...'` string literals); prose rules (SCRY004) must NOT, because an
 * apostrophe pair in English ("the user's role and the agent's job") would
 * wrongly erase text between them.
 */
export function dequote(line: string, includeSingle = true): string {
  let out = line.replace(/`[^`]*`/g, ' ').replace(/"[^"]*"/g, ' ');
  if (includeSingle) out = out.replace(/'[^']*'/g, ' ');
  return out;
}

/** Strip shell/python/js line comments so we don't match inside comments. */
export function stripComment(line: string): string {
  // Remove from the first unquoted '#' (shell/python) — conservative: only when
  // '#' is at start or preceded by whitespace, to avoid eating URLs like a#b.
  const hashIdx = line.search(/(^|\s)#/);
  let out = hashIdx >= 0 ? line.slice(0, hashIdx) : line;
  // Remove // ... when clearly a JS/TS comment (preceded by whitespace or start).
  const slashIdx = out.search(/(^|\s)\/\//);
  if (slashIdx >= 0) out = out.slice(0, slashIdx);
  return out;
}
