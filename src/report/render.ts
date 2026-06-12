/**
 * Renderers for the Discernment Report: terminal (colorized), markdown, and JSON.
 * The JSON renderer emits the report verbatim (it is the stable, versioned
 * contract). Terminal and markdown are human views over the same data.
 */
import pc from 'picocolors';

import {
  SEVERITY_ORDER,
  type DiscernmentReport,
  type Finding,
  type Severity,
} from './schema.js';

const VERDICT_LABEL: Record<DiscernmentReport['verdict'], string> = {
  clean: 'SCRYED ✓ CLEAN',
  flagged: 'FLAGGED',
  blocked: 'BLOCKED',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'CRITICAL',
  warn: 'WARN',
  info: 'INFO',
};

function footer(): string {
  return 'Deterministic scan · Scry v1 by Phazur Labs · Built for inheritance, not hype.';
}

/** Stable, machine-readable output. This is what other tools should consume. */
export function renderJson(report: DiscernmentReport): string {
  return JSON.stringify(report, null, 2);
}

function groupBySeverity(findings: Finding[]): Map<Severity, Finding[]> {
  const groups = new Map<Severity, Finding[]>();
  for (const sev of ['critical', 'warn', 'info'] as Severity[]) {
    const list = findings.filter((f) => f.severity === sev);
    if (list.length) groups.set(sev, list);
  }
  return groups;
}

/** Markdown report — used for `--md`, PR comments, and the README example. */
export function renderMarkdown(report: DiscernmentReport): string {
  const lines: string[] = [];
  lines.push(`# Discernment Report — ${report.skillName}`);
  lines.push('');
  lines.push(`- **Verdict:** ${VERDICT_LABEL[report.verdict]}`);
  lines.push(`- **Version:** ${report.skillVersion ?? '(none)'}`);
  lines.push(`- **Hash:** \`${report.hash.slice(0, 16)}\``);
  lines.push(`- **Criteria:** v${report.criteriaVersion}`);
  lines.push(`- **Scanned:** ${report.timestamp}`);
  lines.push('');

  if (report.scanError) {
    lines.push(`> Scan could not complete: ${report.scanError}`);
    lines.push('> (Failing open — no findings recorded.)');
    lines.push('');
  }

  if (report.findings.length === 0 && !report.scanError) {
    lines.push('No findings. Nothing concealed surfaced by the deterministic checks.');
    lines.push('');
  }

  for (const [sev, list] of groupBySeverity(report.findings)) {
    lines.push(`## ${SEVERITY_LABEL[sev]} (${list.length})`);
    lines.push('');
    for (const f of list) {
      lines.push(`### ${f.ruleId} · ${f.title}`);
      lines.push(`- ${f.file}:${f.line}`);
      lines.push(`- \`${f.snippet}\``);
      lines.push(`- Threat: ${f.threatClass}`);
      lines.push(`- ${f.explanation}`);
      lines.push(`- Remediation: ${f.remediation}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`_${footer()}_`);
  return lines.join('\n');
}

function colorVerdict(verdict: DiscernmentReport['verdict']): string {
  const label = VERDICT_LABEL[verdict];
  if (verdict === 'blocked') return pc.bold(pc.red(label));
  if (verdict === 'flagged') return pc.bold(pc.yellow(label));
  return pc.bold(pc.green(label));
}

function colorSeverity(sev: Severity): string {
  const label = SEVERITY_LABEL[sev];
  if (sev === 'critical') return pc.red(label);
  if (sev === 'warn') return pc.yellow(label);
  return pc.dim(label);
}

/** Human terminal report. */
export function renderTerminal(report: DiscernmentReport): string {
  const lines: string[] = [];
  const versionPart = report.skillVersion ? ` v${report.skillVersion}` : '';
  lines.push(pc.bold(`Discernment Report — ${report.skillName}${versionPart}`));
  lines.push(
    pc.dim(
      `  hash ${report.hash.slice(0, 16)} · criteria v${report.criteriaVersion} · ${report.timestamp}`,
    ),
  );
  lines.push('');
  lines.push(`  ${colorVerdict(report.verdict)}`);
  lines.push('');

  if (report.scanError) {
    lines.push(pc.yellow(`  Scan could not complete: ${report.scanError}`));
    lines.push(
      pc.dim('  Failing open — no findings recorded, your workflow is not blocked.'),
    );
    lines.push('');
  } else if (report.findings.length === 0) {
    lines.push(pc.green('  No findings. Nothing concealed surfaced.'));
    lines.push('');
  }

  for (const [sev, list] of groupBySeverity(report.findings)) {
    for (const f of list) {
      lines.push(`  ${colorSeverity(sev)}  ${pc.bold(f.ruleId)}  ${f.title}`);
      lines.push(pc.dim(`     ${f.file}:${f.line}`));
      lines.push(`     ${pc.dim(f.snippet)}`);
      lines.push(`     ${f.explanation}`);
      lines.push(pc.dim(`     threat: ${f.threatClass}`));
      lines.push(pc.cyan(`     fix: ${f.remediation}`));
      lines.push('');
    }
  }

  lines.push(pc.dim(`  ${footer()}`));
  return lines.join('\n');
}

/** Count findings by severity, for one-line summaries. */
export function severityCounts(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

/** Sort verdicts/findings consistently when listing many skills. */
export function compareReportsBySeverity(
  a: DiscernmentReport,
  b: DiscernmentReport,
): number {
  const worst = (r: DiscernmentReport) =>
    r.findings.length
      ? Math.min(...r.findings.map((f) => SEVERITY_ORDER[f.severity]))
      : 99;
  return worst(a) - worst(b) || a.skillName.localeCompare(b.skillName);
}
