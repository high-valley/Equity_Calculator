#!/usr/bin/env node
/**
 * Generates exact preflop-vs-random-opponent equity for all 169 canonical
 * Texas Hold'em starting hands, using the app's real `computeEquitySync`
 * (full combinatorial enumeration, no Monte Carlo — see src/poker/equity.ts).
 *
 * Preflop + random opponent + no board is the slow case: for ANY two hole
 * cards there are C(50,5) = 2,118,760 board completions, and for each one,
 * C(45,2) = 990 opponent hands — about 2.1 billion (board, opponent) pairs
 * enumerated per hand, taking on the order of several minutes each on this
 * machine. Doing this once per canonical hand (169 total) instead of once
 * per concrete-card combination is what makes it tractable: the result
 * depends only on the two hole card RANKS and whether they're suited, never
 * on the specific suits chosen (see canonicalHandKey() in
 * src/poker/preflopRandomTable.ts) — so we only need to compute a single
 * representative per canonical hand.
 *
 * Approach:
 *   1. tsc-compile src/poker/*.ts (pure logic, no React/DOM deps) to plain
 *      CommonJS under scripts/.preflop-build/, so plain `node` worker
 *      processes can `require()` it directly (no ts-node/tsx per-worker
 *      startup or ESM-loader overhead).
 *   2. Fork one child process per CPU core (scripts/preflopTableWorker.cjs),
 *      each handed a disjoint slice of the 169 hands.
 *   3. As each worker finishes a hand, it reports the result over IPC; this
 *      parent process appends it to the in-memory table and rewrites the
 *      output JSON immediately (atomically, via a temp file + rename), so a
 *      kill/crash/interruption loses at most the one in-flight hand per
 *      worker. Re-running the script skips hands already present in that
 *      JSON, so an interrupted run resumes rather than restarting.
 *
 * Usage:
 *   node scripts/generatePreflopRandomTable.mjs [options]
 *
 * Options:
 *   --concurrency=N   number of worker processes (default: os.cpus().length)
 *   --out=PATH        output JSON path (default: scripts/generated/preflopRandomTable.raw.json)
 *   --only=AA,KQs,72o  comma-separated canonical keys to (re)compute, for smoke-testing
 *   --force            recompute hands even if already present in the output JSON
 *
 * Once this completes (all 169 keys present in the output JSON), convert it
 * into the TypeScript lookup table the app consumes with:
 *   node scripts/buildPreflopRandomTableModule.mjs
 * (that step is intentionally separate and fast — this script is the slow,
 * resumable, hours-long part).
 */

import { execFileSync } from 'node:child_process';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const BUILD_DIR = join(__dirname, '.preflop-build');
const WORKER_PATH = join(__dirname, 'preflopTableWorker.cjs');
const TSCONFIG_PATH = join(__dirname, 'tsconfig.preflop-build.json');

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function parseArgs(argv) {
  const opts = { concurrency: os.cpus().length, out: join(__dirname, 'generated', 'preflopRandomTable.raw.json'), only: null, force: false };
  for (const arg of argv) {
    if (arg.startsWith('--concurrency=')) opts.concurrency = Number(arg.slice('--concurrency='.length));
    else if (arg.startsWith('--out=')) opts.out = join(REPO_ROOT, arg.slice('--out='.length));
    else if (arg.startsWith('--only=')) opts.only = new Set(arg.slice('--only='.length).split(',').filter(Boolean));
    else if (arg === '--force') opts.force = true;
    else throw new Error(`Unrecognized argument: ${arg}`);
  }
  return opts;
}

/** All 169 canonical starting hands: 13 pairs + 78 suited + 78 offsuit two-rank combos. */
function allCanonicalHands() {
  const hands = [];
  for (let i = 0; i < RANKS.length; i++) {
    hands.push({ key: `${RANKS[i]}${RANKS[i]}`, r1: RANKS[i], r2: RANKS[i], kind: 'pair' });
  }
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i + 1; j < RANKS.length; j++) {
      hands.push({ key: `${RANKS[i]}${RANKS[j]}s`, r1: RANKS[i], r2: RANKS[j], kind: 'suited' });
    }
  }
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i + 1; j < RANKS.length; j++) {
      hands.push({ key: `${RANKS[i]}${RANKS[j]}o`, r1: RANKS[i], r2: RANKS[j], kind: 'offsuit' });
    }
  }
  return hands;
}

function compileSrc() {
  console.log('[build] compiling src/poker -> scripts/.preflop-build (CommonJS) ...');
  execFileSync('npx', ['tsc', '-p', TSCONFIG_PATH], { stdio: 'inherit', cwd: REPO_ROOT });
  // src/../package.json declares "type": "module"; without this, node would try
  // (and fail) to load the compiled .js files as ES modules.
  writeFileSync(join(BUILD_DIR, 'package.json'), JSON.stringify({ type: 'commonjs' }) + '\n');
  console.log('[build] done.');
}

function loadExisting(outPath) {
  if (!existsSync(outPath)) return {};
  try {
    return JSON.parse(readFileSync(outPath, 'utf8'));
  } catch (err) {
    console.error(`[warn] could not parse existing ${outPath} (${err.message}); starting fresh.`);
    return {};
  }
}

function writeAtomic(outPath, data) {
  const tmp = `${outPath}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, outPath);
}

function shardHands(hands, concurrency) {
  const shards = Array.from({ length: concurrency }, () => []);
  hands.forEach((hand, i) => shards[i % concurrency].push(hand));
  return shards.filter((s) => s.length > 0);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(dirname(opts.out), { recursive: true });

  compileSrc();

  const table = loadExisting(opts.out);
  const allHands = allCanonicalHands();
  const wanted = opts.only ? allHands.filter((h) => opts.only.has(h.key)) : allHands;
  const pending = wanted.filter((h) => opts.force || !(h.key in table));

  console.log(`[plan] ${wanted.length} hand(s) requested, ${wanted.length - pending.length} already done, ${pending.length} to compute.`);
  if (pending.length === 0) {
    console.log('[plan] nothing to do.');
    return;
  }

  const concurrency = Math.max(1, Math.min(opts.concurrency, pending.length));
  const shards = shardHands(pending, concurrency);
  console.log(`[plan] running ${shards.length} worker process(es) for ${pending.length} hand(s).`);

  const runStart = Date.now();
  let completed = 0;
  let doneWorkers = 0;

  const children = [];
  function killAllChildren() {
    for (const child of children) {
      if (!child.killed && child.exitCode === null) child.kill('SIGTERM');
    }
  }

  return new Promise((resolve, reject) => {
    shards.forEach((shard, workerId) => {
      const child = fork(WORKER_PATH, [BUILD_DIR, JSON.stringify(shard), String(workerId)], {
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });
      children.push(child);

      child.on('message', (msg) => {
        if (msg.type === 'result') {
          table[msg.key] = msg.result;
          writeAtomic(opts.out, table);
          completed++;
          const overallElapsedS = ((Date.now() - runStart) / 1000).toFixed(0);
          console.log(
            `[w${msg.workerId}] ${msg.key.padEnd(3)} equity=${msg.result.equityPct.toFixed(3)}% ` +
              `win=${msg.result.winPct.toFixed(3)}% tie=${msg.result.tiePct.toFixed(3)}% ` +
              `(hand ${(msg.elapsedMs / 1000).toFixed(1)}s, progress ${completed}/${pending.length}, run ${overallElapsedS}s elapsed)`,
          );
        }
        // msg.type === 'done' is sent just before the worker's own process.exit();
        // completion bookkeeping happens on the 'exit' event below, not here, so a
        // worker is only ever counted once.
      });

      child.on('exit', (code) => {
        if (code !== 0) {
          killAllChildren();
          reject(new Error(`worker ${workerId} exited with code ${code}`));
          return;
        }
        doneWorkers++;
        if (doneWorkers === shards.length) {
          const totalS = ((Date.now() - runStart) / 1000).toFixed(0);
          console.log(`[done] all ${pending.length} hand(s) computed in ${totalS}s. Output: ${opts.out}`);
          resolve();
        }
      });

      child.on('error', (err) => {
        killAllChildren();
        reject(err);
      });
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
