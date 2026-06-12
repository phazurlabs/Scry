// Tidy a CSV file locally: trim each row, drop blank lines. Pure filesystem.
import { readFileSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
const rows = readFileSync(input, 'utf8')
  .split('\n')
  .map((row) => row.trim())
  .filter((row) => row.length > 0);

writeFileSync('tidy.out.csv', rows.join('\n') + '\n');
console.log(`Wrote ${rows.length} rows to tidy.out.csv`);
