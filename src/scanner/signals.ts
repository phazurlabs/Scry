/**
 * Cross-rule detectors. SCRY001 (network egress) and SCRY008 (description vs.
 * behavior) both need to agree on "does this line make a network call", so the
 * definition lives here once. Keeping it shared means the two rules can never
 * drift apart and disagree.
 *
 * Detection is language-aware by file extension. This matters for precision: a
 * generic /fetch\(/ pattern would wrongly flag a Python function named `fetch`,
 * so JS-only APIs are applied only to JS/TS files, Python APIs only to .py, etc.
 */
import { stripComment } from './util.js';

/**
 * Shell network clients. These can be invoked from any language (subprocess,
 * os.system, backticks), so they apply to every script. Anchored at a command
 * boundary to avoid matching the word inside a string or path.
 */
const SHELL_PATTERNS: RegExp[] = [
  /(^|[;|&(`]|\$\()\s*(curl|wget|nc|ncat|telnet|scp|sftp|ftp)\b/i,
  /\b(Invoke-WebRequest|Invoke-RestMethod)\b/,
];

const PYTHON_PATTERNS: RegExp[] = [
  /\brequests\.(get|post|put|delete|patch|head|request|Session)\b/,
  /\burllib\.request\b/,
  /\burllib2\.\w+/,
  /\bhttp\.client\b/,
  /\bsocket\.(create_connection|connect)\s*\(/,
  /\b(httpx|aiohttp)\.\w+/,
];

const JS_PATTERNS: RegExp[] = [
  /\bfetch\s*\(/,
  // Library usage only — a member access or call. A bare word match here would
  // flag the English word "got" inside an error message (a real-world FP).
  /\b(axios|got|ky|node-fetch|superagent|undici)\s*[.(]/,
  /\b(from|require)\s*\(?\s*['"](axios|got|ky|node-fetch|superagent|undici)['"]/,
  /\bhttps?\.(get|request)\s*\(/,
  /\bXMLHttpRequest\b/,
];

const RUBY_PATTERNS: RegExp[] = [/\bNet::HTTP\b/, /\bopen-uri\b/];
const PERL_PATTERNS: RegExp[] = [/\bLWP::UserAgent\b/, /\bHTTP::Request\b/];
const PHP_PATTERNS: RegExp[] = [
  /\bfile_get_contents\s*\(\s*['"]https?:/i,
  /\bcurl_exec\s*\(/,
];

const BY_EXT: Record<string, RegExp[]> = {
  '.py': PYTHON_PATTERNS,
  '.js': JS_PATTERNS,
  '.mjs': JS_PATTERNS,
  '.cjs': JS_PATTERNS,
  '.ts': JS_PATTERNS,
  '.rb': RUBY_PATTERNS,
  '.pl': PERL_PATTERNS,
  '.php': PHP_PATTERNS,
};

/** True when a line of script source appears to perform a network call. */
export function isNetworkCall(line: string, ext: string): boolean {
  const code = stripComment(line);
  const patterns = [...SHELL_PATTERNS, ...(BY_EXT[ext] ?? [])];
  return patterns.some((re) => {
    re.lastIndex = 0;
    return re.test(code);
  });
}

/**
 * True when a line references a loopback/local address. Connections to the local
 * host are not egress (test servers, health-check polling), so SCRY001/SCRY008
 * treat a loopback-only call as benign rather than as exfiltration.
 */
const LOOPBACK = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\])\b/i;

export function isLoopback(line: string): boolean {
  LOOPBACK.lastIndex = 0;
  return LOOPBACK.test(line);
}

/** True when `host` is a loopback/local address. */
export function isLoopbackHost(host: string): boolean {
  return ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(
    host.toLowerCase(),
  );
}
