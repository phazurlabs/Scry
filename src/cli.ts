#!/usr/bin/env node
/**
 * Scry CLI. Commands: init, audit, scan, allow, status, uninstall.
 *
 * The CLI is deliberately thin — it wires arguments to the scanner, lock, and
 * installer modules and renders their output. All real logic lives in those
 * modules so it can be tested without spawning a process.
 */
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

import { Command } from 'commander';
import pc from 'picocolors';

import { auditSkills, writeLock, type AuditedSkill } from './audit.js';
import { installHooks, isInstalled, uninstallHooks } from './install.js';
import { loadLock, saveLock, type AllowEntry } from './lockfile.js';
import { discoverSkills, resolvePaths } from './paths.js';
import { hashSkill } from './scanner/load.js';
import { scanSkill } from './scanner/index.js';
import { CRITERIA_VERSION, type DiscernmentReport } from './report/schema.js';
import {
  compareReportsBySeverity,
  renderJson,
  renderMarkdown,
  renderTerminal,
  severityCounts,
} from './report/render.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string; name: string };

const program = new Command();
program
  .name('scry')
  .description("See what is hidden in your agent's skills before you run them.")
  .version(pkg.version);

function emitReport(
  report: DiscernmentReport,
  opts: { json?: boolean; md?: boolean },
): void {
  if (opts.json) console.log(renderJson(report));
  else if (opts.md) console.log(renderMarkdown(report));
  else console.log(renderTerminal(report));
}

/** One-line ranked summary used by init and audit-all. */
function printSummary(audited: AuditedSkill[]): void {
  const sorted = [...audited].sort((a, b) =>
    compareReportsBySeverity(a.report, b.report),
  );
  for (const { skill, report } of sorted) {
    const c = severityCounts(report.findings);
    const verdict =
      report.verdict === 'blocked'
        ? pc.red('BLOCKED')
        : report.verdict === 'flagged'
          ? pc.yellow('FLAGGED')
          : pc.green('CLEAN  ');
    const detail = pc.dim(`${c.critical} critical · ${c.warn} warn · ${c.info} info`);
    console.log(`  ${verdict}  ${skill.name.padEnd(28)} ${detail}`);
  }
}

interface CommonPathFlags {
  settings?: string;
  skillsDir?: string[];
}

function pathsFor(flags: CommonPathFlags) {
  return resolvePaths({
    settingsPath: flags.settings,
    skillsDirs: flags.skillsDir,
  });
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------
program
  .command('init')
  .description('Audit installed skills, write the lock, and install the hook gate.')
  .option('--dry-run', 'Show what would change (settings diff + report); write nothing.')
  .option('--no-hooks', 'Audit and write the lock, but do not install hooks.')
  .option('--settings <path>', 'Path to the settings.json to install hooks into.')
  .option('--skills-dir <dir...>', 'Override the skills directories to scan.')
  .action((opts) => {
    const paths = pathsFor(opts);
    const skills = discoverSkills(paths.skillsDirs);

    if (skills.length === 0) {
      console.log(pc.bold('Scry: no skills found yet.'));
      console.log(
        pc.dim(
          `  Looked in: ${paths.skillsDirs.join(', ') || '(no skills directories exist)'}\n` +
            '  Install a skill, then run `scry init` again to scry it.',
        ),
      );
    } else {
      const audited = auditSkills(skills);
      if (!opts.dryRun) writeLock(paths.lockPath, audited);
      console.log(pc.bold(`Scryed ${skills.length} skill(s):`));
      printSummary(audited);
    }

    if (opts.hooks === false) {
      console.log(pc.dim('\n  Skipping hook installation (--no-hooks).'));
      return;
    }

    const result = installHooks(paths.settingsPath, undefined, { dryRun: opts.dryRun });
    if (opts.dryRun) {
      console.log(pc.bold('\n  settings.json (dry-run, not written):'));
      console.log(pc.dim(`  → ${paths.settingsPath}`));
      console.log(result.after.replace(/^/gm, '  '));
    } else if (result.changed) {
      console.log(pc.green(`\n  Installed Scry hooks into ${paths.settingsPath}`));
    } else {
      console.log(pc.dim(`\n  Hooks already present in ${paths.settingsPath}`));
    }
  });

// ---------------------------------------------------------------------------
// audit [path]
// ---------------------------------------------------------------------------
program
  .command('audit')
  .description('Re-scan one skill (by path) or every installed skill.')
  .argument('[path]', 'Path to a single skill directory; omit to audit all.')
  .option('--json', 'Emit the JSON Discernment Report.')
  .option('--md', 'Emit the markdown Discernment Report.')
  .option('--ci', 'Exit non-zero if any critical finding is present (for CI).')
  .option('--skills-dir <dir...>', 'Override the skills directories to scan.')
  .action((path: string | undefined, opts) => {
    const paths = pathsFor(opts);

    if (path) {
      const report = scanSkill(path, {});
      emitReport(report, opts);
      finishCi(opts.ci, [report]);
      return;
    }

    const skills = discoverSkills(paths.skillsDirs);
    if (skills.length === 0) {
      console.log(pc.dim('No skills found to audit.'));
      return;
    }
    const audited = auditSkills(skills);
    writeLock(paths.lockPath, audited);
    if (opts.json)
      console.log(
        JSON.stringify(
          audited.map((a) => a.report),
          null,
          2,
        ),
      );
    else if (opts.md)
      audited.forEach((a) => console.log(renderMarkdown(a.report) + '\n'));
    else printSummary(audited);
    finishCi(
      opts.ci,
      audited.map((a) => a.report),
    );
  });

function finishCi(ci: boolean | undefined, reports: DiscernmentReport[]): void {
  if (!ci) return;
  const blocked = reports.some((r) => r.verdict === 'blocked');
  if (blocked) {
    console.error(pc.red('CI: critical findings present — failing.'));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// scan <path>
// ---------------------------------------------------------------------------
program
  .command('scan')
  .description('Scan a single skill directory and print its report. Writes nothing.')
  .argument('<path>', 'Path to the skill directory to scan.')
  .option('--json', 'Emit the JSON Discernment Report.')
  .option('--md', 'Emit the markdown Discernment Report.')
  .action((path: string, opts) => {
    if (!existsSync(path)) {
      console.error(pc.red(`No such directory: ${path}`));
      process.exit(2);
    }
    emitReport(scanSkill(path, {}), opts);
  });

// ---------------------------------------------------------------------------
// allow <ruleId> <skillName>
// ---------------------------------------------------------------------------
program
  .command('allow')
  .description('Record a logged allowlist entry permitting a rule for one skill.')
  .argument('<ruleId>', 'The rule id to allow, e.g. SCRY001.')
  .argument('<skillName>', 'The skill name the allowance applies to.')
  .requiredOption('--reason <text>', 'Why this finding is acceptable (required, logged).')
  .option('--by <who>', 'Who authorized this.', process.env.USER ?? 'cli')
  .action((ruleId: string, skillName: string, opts) => {
    const paths = pathsFor({});
    const lock = loadLock(paths.lockPath);
    const entry: AllowEntry = {
      ruleId: ruleId.toUpperCase(),
      skill: skillName,
      reason: opts.reason,
      at: new Date().toISOString(),
      by: opts.by,
    };
    lock.allowlist = lock.allowlist.filter(
      (e) => !(e.ruleId === entry.ruleId && e.skill === entry.skill),
    );
    lock.allowlist.push(entry);
    saveLock(paths.lockPath, lock);
    console.log(
      pc.green(`Allowed ${entry.ruleId} for "${entry.skill}".`) +
        pc.dim(`\n  reason: ${entry.reason}\n  logged at ${entry.at} by ${entry.by}`),
    );
  });

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------
program
  .command('status')
  .description('Show hook installation, lock freshness, and criteria version.')
  .option('--settings <path>', 'Path to the settings.json to check.')
  .option('--skills-dir <dir...>', 'Override the skills directories to scan.')
  .action((opts) => {
    const paths = pathsFor(opts);
    const installed = isInstalled(paths.settingsPath);
    const lock = loadLock(paths.lockPath);
    const skills = discoverSkills(paths.skillsDirs);

    console.log(pc.bold('Scry status'));
    console.log(`  hooks installed: ${installed ? pc.green('yes') : pc.yellow('no')}`);
    console.log(`  settings: ${pc.dim(paths.settingsPath)}`);
    console.log(
      `  criteria version: ${CRITERIA_VERSION} (lock: ${lock.criteriaVersion})`,
    );
    console.log(`  lock: ${pc.dim(paths.lockPath)}`);
    console.log(`  skills discovered: ${skills.length}`);

    let stale = 0;
    for (const skill of skills) {
      const entry = lock.skills[skill.name];
      if (!entry) continue;
      const current = (() => {
        try {
          return hashSkill(skill.dir);
        } catch {
          return entry.hash;
        }
      })();
      if (entry.stale || current !== entry.hash) stale++;
    }
    const unscanned = skills.filter((s) => !lock.skills[s.name]).length;
    console.log(
      `  lock fresh: ${stale === 0 && unscanned === 0 ? pc.green('yes') : pc.yellow(`no (${stale} stale, ${unscanned} unscanned)`)}`,
    );
    if (lock.allowlist.length) {
      console.log(`  allowlist entries: ${lock.allowlist.length}`);
    }
  });

// ---------------------------------------------------------------------------
// uninstall
// ---------------------------------------------------------------------------
program
  .command('uninstall')
  .description('Remove Scry hooks from settings.json. Optionally delete .scry/.')
  .option('--settings <path>', 'Path to the settings.json to clean.')
  .option('--purge', 'Also delete the .scry directory (lock + allowlist).')
  .action((opts) => {
    const paths = pathsFor(opts);
    const result = uninstallHooks(paths.settingsPath);
    if (result.changed)
      console.log(pc.green(`Removed Scry hooks from ${paths.settingsPath}`));
    else console.log(pc.dim('No Scry hooks were present.'));

    if (opts.purge) {
      if (existsSync(paths.scryDir)) {
        rmSync(paths.scryDir, { recursive: true, force: true });
        console.log(pc.green(`Deleted ${paths.scryDir}`));
      }
    } else if (existsSync(paths.scryDir)) {
      console.log(
        pc.dim(
          `  Kept ${paths.scryDir} (lock + allowlist). Re-run with --purge to delete it.`,
        ),
      );
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  // Surface a clean message (e.g. a permission error writing the lock, or a
  // malformed settings.json) instead of an unhandled-rejection stack trace.
  console.error(pc.red(`scry: ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});
