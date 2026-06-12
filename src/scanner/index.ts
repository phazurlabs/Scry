/**
 * Scanner orchestration. Loads a skill, runs every rule over it, and assembles a
 * deterministic Discernment Report.
 *
 * Fail-open on infrastructure: if loading or a rule throws, we record the error
 * and return a clean verdict rather than blocking the user's workflow over our
 * own bug. Findings themselves still fail closed (a confirmed critical blocks).
 */
import { existsSync } from 'node:fs';

import {
  CRITERIA_VERSION,
  SCHEMA_VERSION,
  sortFindings,
  verdictFor,
  type DiscernmentReport,
  type Finding,
} from '../report/schema.js';
import { hashSkill, loadSkill } from './load.js';
import { RULES } from './rules/index.js';
import type { SkillContext } from './types.js';

export interface ScanOptions {
  /** Fixed timestamp, for reproducible tests. Defaults to now. */
  now?: string;
}

/** Run all rules over a pre-loaded context. Pure given the context. */
export function runRules(ctx: SkillContext): Finding[] {
  const findings: Finding[] = [];
  for (const rule of RULES) {
    try {
      findings.push(...rule.check(ctx));
    } catch (err) {
      // A single rule blowing up must not take down the scan. Record nothing as
      // a finding (fail open) — the rule simply contributed no result.
      process.stderr.write(`scry: rule ${rule.id} errored: ${String(err)}\n`);
    }
  }
  return sortFindings(findings);
}

/** Scan a skill directory and produce its Discernment Report. */
export function scanSkill(dir: string, opts: ScanOptions = {}): DiscernmentReport {
  const timestamp = opts.now ?? new Date().toISOString();

  if (!existsSync(dir)) {
    return baseReport('unknown', null, '', timestamp, {
      scanError: `skill directory not found: ${dir}`,
    });
  }

  try {
    const ctx = loadSkill(dir);
    const hash = hashSkill(dir);
    const findings = runRules(ctx);
    return {
      schemaVersion: SCHEMA_VERSION,
      criteriaVersion: CRITERIA_VERSION,
      skillName: ctx.name,
      skillVersion: ctx.frontmatter?.version ?? null,
      hash,
      timestamp,
      verdict: verdictFor(findings),
      findings,
    };
  } catch (err) {
    // Fail open: the scanner crashed, so we allow rather than brick the workflow.
    return baseReport('unknown', null, '', timestamp, {
      scanError: `scan failed: ${String(err)}`,
    });
  }
}

function baseReport(
  name: string,
  version: string | null,
  hash: string,
  timestamp: string,
  extra: Partial<DiscernmentReport>,
): DiscernmentReport {
  return {
    schemaVersion: SCHEMA_VERSION,
    criteriaVersion: CRITERIA_VERSION,
    skillName: name,
    skillVersion: version,
    hash,
    timestamp,
    verdict: 'clean',
    findings: [],
    ...extra,
  };
}
