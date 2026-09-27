#!/usr/bin/env node
/**
 * Converts the raw JSON produced by generatePreflopRandomTable.mjs into the
 * committed TypeScript module src/poker/preflopRandomTable.ts.
 *
 * Fast and re-runnable any time the raw JSON changes; the slow part is the
 * generator script, not this conversion.
 *
 * Usage:
 *   node scripts/buildPreflopRandomTableModule.mjs [--in=PATH] [--out=PATH]
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    in: join(__dirname, 'generated', 'preflopRandomTable.raw.json'),
    out: join(REPO_ROOT, 'src', 'poker', 'preflopRandomTable.ts'),
  };
  for (const arg of argv) {
    if (arg.startsWith('--in=')) opts.in = join(REPO_ROOT, arg.slice('--in='.length));
    else if (arg.startsWith('--out=')) opts.out = join(REPO_ROOT, arg.slice('--out='.length));
    else throw new Error(`Unrecognized argument: ${arg}`);
  }
  return opts;
}

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function expectedKeys() {
  const keys = [];
  for (const r of RANKS) keys.push(`${r}${r}`);
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i + 1; j < RANKS.length; j++) keys.push(`${RANKS[i]}${RANKS[j]}s`);
  }
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i + 1; j < RANKS.length; j++) keys.push(`${RANKS[i]}${RANKS[j]}o`);
  }
  return keys;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(readFileSync(opts.in, 'utf8'));

  const keys = expectedKeys();
  const missing = keys.filter((k) => !(k in raw));
  if (missing.length > 0) {
    throw new Error(`Raw table is incomplete; missing ${missing.length} key(s): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', ...' : ''}`);
  }
  const extra = Object.keys(raw).filter((k) => !keys.includes(k));
  if (extra.length > 0) {
    throw new Error(`Raw table has unexpected key(s) not among the 169 canonical hands: ${extra.join(', ')}`);
  }

  const entries = keys
    .map((key) => {
      const r = raw[key];
      // Quoted unconditionally: keys like "72o" are neither a valid identifier (leading
      // digit) nor a numeric literal (trailing letter), so they're not legal unquoted.
      return `  "${key}": { winPct: ${r.winPct}, tiePct: ${r.tiePct}, losePct: ${r.losePct}, equityPct: ${r.equityPct}, trials: ${r.trials} },`;
    })
    .join('\n');

  const contents = `${HEADER}\n\nexport const PREFLOP_RANDOM_TABLE: Record<string, EquityResultData> = {\n${entries}\n};\n${FOOTER}`;
  writeFileSync(opts.out, contents);
  console.log(`Wrote ${opts.out} (${keys.length} entries).`);
}

const HEADER = `import type { Card, EquityResultData } from './types';
import { RANK_VALUE } from './cards';

/**
 * Exact preflop equity vs. a uniformly random opponent hand, for all 169
 * canonical Texas Hold'em starting hands, with no board cards dealt.
 *
 * WHAT THIS IS
 * ------------
 * Each entry is the *exact* result of computeEquitySync() (src/poker/equity.ts)
 * — full combinatorial enumeration over every board completion and every
 * possible random opponent hand, not a Monte Carlo approximation, not
 * rounded from a published chart. It is exactly what the app itself would
 * compute for that hand, board=[], opponent=random.
 *
 * HOW IT WAS GENERATED
 * ---------------------
 * scripts/generatePreflopRandomTable.mjs computed one representative
 * concrete-card hand per canonical hand (see canonicalHandKey() below for
 * how a hand maps to its key) by calling the real computeEquitySync(), in
 * parallel worker processes, and wrote the raw results to
 * scripts/generated/preflopRandomTable.raw.json. This file was then
 * produced from that JSON by scripts/buildPreflopRandomTableModule.mjs.
 * Regenerate by re-running the generator (slow, hours) and then the build
 * script (fast), rather than by hand-editing this file.
 *
 * KEY SCHEME
 * ----------
 * Keys are the 169 canonical starting hands in standard notation:
 *   - 13 pocket pairs:      "AA", "KK", ..., "22"
 *   - 78 suited combos:     "AKs", "AQs", ..., "32s"   (higher rank first)
 *   - 78 offsuit combos:    "AKo", "AQo", ..., "32o"   (higher rank first)
 * Rank characters match src/poker/types.ts's Rank type ('A','K','Q','J','T',
 * '9'..'2'); "T" is ten. A given two-card hand's equity vs. random depends
 * only on its two ranks and suitedness (never on which specific suits were
 * dealt), so canonicalHandKey() below is a total, order-independent map from
 * any two Cards to one of these 169 keys — use it to look up a hand here.
 */

/** Maps any two hole cards to their canonical key into PREFLOP_RANDOM_TABLE, e.g. "AKs", "72o", "TT". */
export function canonicalHandKey(cardA: Card, cardB: Card): string {
  const [hi, lo] =
    RANK_VALUE[cardA.rank] >= RANK_VALUE[cardB.rank] ? [cardA, cardB] : [cardB, cardA];
  if (hi.rank === lo.rank) return \`\${hi.rank}\${lo.rank}\`;
  const suitedness = hi.suit === lo.suit ? 's' : 'o';
  return \`\${hi.rank}\${lo.rank}\${suitedness}\`;
}`;

const FOOTER = '';

main();
