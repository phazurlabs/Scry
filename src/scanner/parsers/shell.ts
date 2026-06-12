/**
 * Deliberately small shell + URL helpers. This is NOT a real shell parser — a
 * faithful POSIX parser is huge and the rules only need three cheap operations:
 *   1. split a line into whitespace/quote-delimited tokens,
 *   2. pull out URLs and bare hostnames,
 *   3. test whether a path token escapes the skill's own directory.
 * Everything here is pure and string-only so it stays deterministic.
 */

/** Split a line into tokens, honoring single and double quotes. */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return tokens;
}

const URL_RE = /\bhttps?:\/\/([^\s"'`)\]]+)/gi;

/** Extract every host referenced by an http(s) URL on a line. */
export function extractHosts(line: string): string[] {
  const hosts: string[] = [];
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(line)) !== null) {
    const rest = m[1] ?? '';
    const host = rest.split(/[/?#:]/)[0] ?? '';
    if (host) hosts.push(host.toLowerCase());
  }
  return hosts;
}

/** True when a URL with an explicit http(s) scheme appears on the line. */
export function hasUrl(line: string): boolean {
  URL_RE.lastIndex = 0;
  return URL_RE.test(line);
}

/**
 * Heuristic: does a path token point outside the skill's own directory?
 * Absolute paths, home-relative (~), and parent-escaping (../) all qualify.
 * Paths that stay within the skill (./x, x/y, $SKILL_DIR/x) do not.
 */
export function escapesSkillDir(token: string): boolean {
  const t = token.replace(/^["']|["']$/g, '');
  if (t.startsWith('/')) return true; // absolute
  if (t.startsWith('~')) return true; // home
  if (/(^|\/)\.\.(\/|$)/.test(t)) return true; // contains a ..
  return false;
}
