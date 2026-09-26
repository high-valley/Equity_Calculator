'use strict';

/**
 * Worker process for generatePreflopRandomTable.mjs.
 *
 * Forked (via child_process.fork) once per shard. Receives its list of assigned
 * hands as a JSON blob on argv, requires the tsc-compiled CommonJS build of
 * src/poker/{equity,cards}.ts, computes computeEquitySync() for each hand in turn,
 * and reports each result back to the parent over the IPC channel as soon as it's
 * done (so the parent can persist progress incrementally and print a log line).
 *
 * argv[2] = absolute path to the compiled build dir (contains equity.js, cards.js, ...)
 * argv[3] = JSON array of { key, r1, r2, kind } hand defs assigned to this worker
 * argv[4] = worker id (integer, for logging only)
 */

const buildDir = process.argv[2];
const hands = JSON.parse(process.argv[3]);
const workerId = Number(process.argv[4]);

const { computeEquitySync } = require(`${buildDir}/equity.js`);
const { makeCard } = require(`${buildDir}/cards.js`);

function heroCardsFor(hand) {
  const { r1, r2, kind } = hand;
  if (kind === 'pair') return [makeCard(r1, 'spades'), makeCard(r2, 'hearts')];
  if (kind === 'suited') return [makeCard(r1, 'spades'), makeCard(r2, 'spades')];
  return [makeCard(r1, 'spades'), makeCard(r2, 'hearts')]; // offsuit
}

(async () => {
  for (const hand of hands) {
    const start = Date.now();
    const result = computeEquitySync({
      heroCards: heroCardsFor(hand),
      boardCards: [],
      opponent: { mode: 'random', cards: [] },
    });
    const elapsedMs = Date.now() - start;
    process.send({ type: 'result', workerId, key: hand.key, result, elapsedMs });
  }
  process.send({ type: 'done', workerId });
  process.exit(0);
})();
