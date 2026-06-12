/**
 * Versioned, stable types for the Discernment Report. People will build on this
 * JSON, so the shape changes only with a bump to SCHEMA_VERSION.
 */
import { z } from 'zod';

/** Bump on any breaking change to the JSON report shape. */
export const SCHEMA_VERSION = '1.0.0';

/**
 * The rule set version. Bump when rules are added, removed, or their matching
 * behavior changes, so a lock written under old criteria can be detected as
 * stale. Independent of SCHEMA_VERSION.
 */
export const CRITERIA_VERSION = '1.0.0';

export type Severity = 'critical' | 'warn' | 'info';

/** Ordering used everywhere findings are sorted (highest severity first). */
export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warn: 1,
  info: 2,
};

export type Verdict = 'clean' | 'flagged' | 'blocked';

export interface Finding {
  /** Rule that produced this finding, e.g. "SCRY001". */
  ruleId: string;
  severity: Severity;
  /** Documented threat class citation, e.g. "OWASP ASI ... / Agentic Skills Top 10 ...". */
  threatClass: string;
  /** Human title of the rule. */
  title: string;
  /** Path of the offending file, relative to the skill directory. */
  file: string;
  /** 1-based line number, or 0 when the finding is about the whole file/skill. */
  line: number;
  /** The exact matched text (truncated for display by the renderer). */
  snippet: string;
  /** One sentence: what is wrong. */
  explanation: string;
  /** One sentence: how to fix it. */
  remediation: string;
}

export interface DiscernmentReport {
  schemaVersion: string;
  criteriaVersion: string;
  skillName: string;
  /** Declared version from frontmatter/manifest, or null if absent. */
  skillVersion: string | null;
  /** sha256 over the sorted contents of every file in the skill. */
  hash: string;
  /** ISO-8601. The only non-deterministic field; excluded from byte-comparison. */
  timestamp: string;
  verdict: Verdict;
  findings: Finding[];
  /**
   * Present only when the scanner itself failed (fail-open on infrastructure).
   * When set, findings is empty and the verdict is "clean" so we never brick a
   * workflow over our own bug.
   */
  scanError?: string;
}

export const findingSchema = z.object({
  ruleId: z.string(),
  severity: z.enum(['critical', 'warn', 'info']),
  threatClass: z.string(),
  title: z.string(),
  file: z.string(),
  line: z.number().int().nonnegative(),
  snippet: z.string(),
  explanation: z.string(),
  remediation: z.string(),
});

export const discernmentReportSchema = z.object({
  schemaVersion: z.string(),
  criteriaVersion: z.string(),
  skillName: z.string(),
  skillVersion: z.string().nullable(),
  hash: z.string(),
  timestamp: z.string(),
  verdict: z.enum(['clean', 'flagged', 'blocked']),
  findings: z.array(findingSchema),
  scanError: z.string().optional(),
});

/** Derive the overall verdict from a finding set. */
export function verdictFor(findings: Finding[]): Verdict {
  if (findings.some((f) => f.severity === 'critical')) return 'blocked';
  if (findings.some((f) => f.severity === 'warn')) return 'flagged';
  return 'clean';
}

/** Deterministic ordering: severity, then ruleId, then file, then line. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );
}
