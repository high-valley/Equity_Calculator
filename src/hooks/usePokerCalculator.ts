import { useEffect, useMemo, useRef, useState } from 'react';
import { describeHandJa, evaluateHand } from '../poker/evaluator';
import { analyzeDraws } from '../poker/outs';
import { getRemainingCards } from '../poker/deck';
import { estimateTotalTrials, type EquityComputeInput } from '../poker/equity';
import { canonicalHandKey, PREFLOP_RANDOM_TABLE } from '../poker/preflopRandomTable';
import type { Card, DrawInfo, EquityResultData, OpponentMode, Phase } from '../poker/types';
import { MAX_OPPONENTS } from '../poker/types';
import type { EquityRequestMessage, EquityResponseMessage } from '../workers/equityWorker';

type Slot = Card | null;

export interface OpponentState {
  mode: OpponentMode;
  slots: Slot[]; // length 2
}

function derivePhase(boardLen: number): Phase {
  if (boardLen >= 5) return 'river';
  if (boardLen >= 4) return 'turn';
  if (boardLen >= 3) return 'flop';
  return 'preflop';
}

function compact(slots: Slot[]): Card[] {
  return slots.filter((c): c is Card => c !== null);
}

function pickRandomTwo(pool: Card[]): [Card, Card] {
  const a = Math.floor(Math.random() * pool.length);
  let b = Math.floor(Math.random() * (pool.length - 1));
  if (b >= a) b++;
  return [pool[a], pool[b]];
}

interface Validation {
  ready: boolean;
  message: string | null;
  input?: EquityComputeInput;
}

function validate(hero: Card[], board: Card[], opponents: OpponentState[]): Validation {
  if (hero.length < 2) {
    return { ready: false, message: hero.length === 0 ? '手札を2枚選んでください。' : 'あと1枚選んでください。' };
  }
  if (![0, 3, 4, 5].includes(board.length)) {
    return { ready: false, message: 'フロップを完成させてください。' };
  }
  for (let i = 0; i < opponents.length; i++) {
    const opp = opponents[i];
    if (opp.mode !== 'specific') continue;
    const cards = compact(opp.slots);
    if (cards.length < 2) {
      const label = opponents.length > 1 ? `相手${i + 1}の` : '相手の';
      return { ready: false, message: cards.length === 0 ? `${label}カードを2枚選んでください。` : `${label}カードをあと1枚選んでください。` };
    }
  }
  return {
    ready: true,
    message: null,
    input: {
      heroCards: [hero[0], hero[1]],
      boardCards: board,
      opponents: opponents.map((o) => ({ mode: o.mode, cards: o.mode === 'specific' ? compact(o.slots) : [] })),
    },
  };
}

export interface PokerCalculator {
  heroSlots: Slot[];
  boardCards: Card[];
  opponents: OpponentState[];
  maxOpponents: number;
  phase: Phase;
  usedCards: Card[];
  message: string | null;
  heavyWarning: string | null;
  isCalculating: boolean;
  progressPct: number | null;
  result: EquityResultData | null;
  currentHandLabel: string | null;
  drawInfo: DrawInfo;
  setHeroCard: (index: 0 | 1, card: Card) => void;
  clearHeroCard: (index: 0 | 1) => void;
  randomizeHero: () => void;
  setBoardCard: (index: number, card: Card) => void;
  clearBoardFrom: (index: number) => void;
  addOpponent: () => void;
  removeOpponent: (oppIndex: number) => void;
  setOpponentMode: (oppIndex: number, mode: OpponentMode) => void;
  setOpponentCard: (oppIndex: number, cardIndex: 0 | 1, card: Card) => void;
  clearOpponentCard: (oppIndex: number, cardIndex: 0 | 1) => void;
  randomizeOpponent: (oppIndex: number) => void;
  reset: () => void;
}

const DEFAULT_OPPONENTS: OpponentState[] = [{ mode: 'random', slots: [null, null] }];

export function usePokerCalculator(): PokerCalculator {
  const [heroSlots, setHeroSlots] = useState<Slot[]>([null, null]);
  const [boardCards, setBoardCards] = useState<Card[]>([]);
  const [opponents, setOpponents] = useState<OpponentState[]>(DEFAULT_OPPONENTS);

  const [result, setResult] = useState<EquityResultData | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progressPct, setProgressPct] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const heroCards = useMemo(() => compact(heroSlots), [heroSlots]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/equityWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<EquityResponseMessage>) => {
      const msg = event.data;
      if (msg.requestId !== requestIdRef.current) return; // superseded by a newer request
      if (msg.type === 'progress') {
        setProgressPct(msg.total > 0 ? Math.min(99, (msg.processed / msg.total) * 100) : 0);
      } else if (msg.type === 'done') {
        setResult(msg.result);
        setIsCalculating(false);
        setProgressPct(null);
      } else {
        setIsCalculating(false);
        setProgressPct(null);
      }
    };
    return () => worker.terminate();
  }, []);

  const validation = useMemo(() => validate(heroCards, boardCards, opponents), [heroCards, boardCards, opponents]);

  // Each random opponent costs roughly as much as one more board card to enumerate
  // exactly (no Monte Carlo shortcut) — several random opponents on an early street
  // can take a very long time. Warn before the user waits on it.
  const heavyWarning = useMemo(() => {
    if (!validation.ready || !validation.input) return null;
    const total = estimateTotalTrials(validation.input);
    if (total > 2_000_000_000) return 'この組み合わせは計算量が非常に多く、結果が出るまでかなり長い時間（数時間以上になることも）かかります。';
    if (total > 20_000_000) return 'ランダムの相手が多い、または盤面が早い段階のため、計算に時間がかかります。';
    return null;
  }, [validation]);

  useEffect(() => {
    // Any request in flight is now stale; requestId no longer matching means the
    // worker will ignore its result even if it's still running (and it never was,
    // for the preflop-vs-random path below).
    requestIdRef.current++;

    if (!validation.ready || !validation.input) {
      setResult(null);
      setIsCalculating(false);
      setProgressPct(null);
      return;
    }

    const { heroCards: hero, boardCards: board, opponents: resolvedOpponents } = validation.input;
    if (resolvedOpponents.length === 1 && resolvedOpponents[0].mode === 'random' && board.length === 0) {
      // Preflop, heads-up vs. a fully random opponent is the one case exhaustive
      // enumeration is too slow for live computation (~2.1B combinations) — but the
      // answer only depends on the two hole card ranks and suitedness, so it's
      // precomputed for all 169 canonical starting hands (see preflopRandomTable.ts).
      const table = PREFLOP_RANDOM_TABLE[canonicalHandKey(hero[0], hero[1])];
      if (table) {
        setResult(table);
        setIsCalculating(false);
        setProgressPct(null);
        return;
      }
    }

    const worker = workerRef.current;
    if (!worker) return;
    const requestId = requestIdRef.current;
    setIsCalculating(true);
    setProgressPct(0);
    setResult(null);
    worker.postMessage({ requestId, input: validation.input } satisfies EquityRequestMessage);
  }, [validation]);

  const usedCards = useMemo(
    () => [
      ...heroCards,
      ...boardCards,
      ...opponents.flatMap((o) => (o.mode === 'specific' ? compact(o.slots) : [])),
    ],
    [heroCards, boardCards, opponents],
  );

  const currentHandLabel = useMemo(() => {
    const combined = [...heroCards, ...boardCards];
    const value = evaluateHand(combined);
    return value ? describeHandJa(value) : null;
  }, [heroCards, boardCards]);

  const drawInfo = useMemo(() => analyzeDraws(heroCards, boardCards), [heroCards, boardCards]);

  function setHeroCard(index: 0 | 1, card: Card): void {
    setHeroSlots((prev) => {
      const next = [...prev];
      next[index] = card;
      return next;
    });
  }

  function clearHeroCard(index: 0 | 1): void {
    setHeroSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  function randomizeHero(): void {
    const excluded = [...boardCards, ...opponents.flatMap((o) => (o.mode === 'specific' ? compact(o.slots) : []))];
    const pool = getRemainingCards(excluded);
    const [a, b] = pickRandomTwo(pool);
    setHeroSlots([a, b]);
  }

  function setBoardCard(index: number, card: Card): void {
    setBoardCards((prev) => {
      const next = [...prev];
      next[index] = card;
      return next;
    });
  }

  function clearBoardFrom(index: number): void {
    setBoardCards((prev) => prev.slice(0, index));
  }

  function addOpponent(): void {
    setOpponents((prev) => {
      if (prev.length >= MAX_OPPONENTS) return prev;
      const next = [...prev];
      if (next.length === 1 && (next[0].mode !== 'specific' || compact(next[0].slots).length < 2)) {
        // Moving from 1 to 2+ opponents: an abstract "random" opponent multiplies
        // enumeration cost (see equity.ts), so every opponent beyond the first must
        // have a concrete hand. Give the sole existing opponent one now.
        const pool = getRemainingCards([...heroCards, ...boardCards]);
        const [a, b] = pickRandomTwo(pool);
        next[0] = { mode: 'specific', slots: [a, b] };
      }
      const excluded = [...heroCards, ...boardCards, ...next.flatMap((o) => compact(o.slots))];
      const pool = getRemainingCards(excluded);
      const [a, b] = pickRandomTwo(pool);
      next.push({ mode: 'specific', slots: [a, b] });
      return next;
    });
  }

  function removeOpponent(oppIndex: number): void {
    setOpponents((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== oppIndex)));
  }

  function setOpponentMode(oppIndex: number, mode: OpponentMode): void {
    setOpponents((prev) =>
      prev.map((o, i) => (i === oppIndex ? { mode, slots: mode === 'random' ? [null, null] : o.slots } : o)),
    );
  }

  function randomizeOpponent(oppIndex: number): void {
    setOpponents((prev) => {
      const excluded = [
        ...heroCards,
        ...boardCards,
        ...prev.flatMap((o, i) => (i === oppIndex ? [] : compact(o.slots))),
      ];
      const pool = getRemainingCards(excluded);
      const [a, b] = pickRandomTwo(pool);
      return prev.map((o, i) => (i === oppIndex ? { mode: 'specific' as const, slots: [a, b] } : o));
    });
  }

  function setOpponentCard(oppIndex: number, cardIndex: 0 | 1, card: Card): void {
    setOpponents((prev) =>
      prev.map((o, i) => {
        if (i !== oppIndex) return o;
        const slots = [...o.slots];
        slots[cardIndex] = card;
        return { ...o, slots };
      }),
    );
  }

  function clearOpponentCard(oppIndex: number, cardIndex: 0 | 1): void {
    setOpponents((prev) =>
      prev.map((o, i) => {
        if (i !== oppIndex) return o;
        const slots = [...o.slots];
        slots[cardIndex] = null;
        return { ...o, slots };
      }),
    );
  }

  function reset(): void {
    setHeroSlots([null, null]);
    setBoardCards([]);
    setOpponents(DEFAULT_OPPONENTS);
  }

  return {
    heroSlots,
    boardCards,
    opponents,
    maxOpponents: MAX_OPPONENTS,
    phase: derivePhase(boardCards.length),
    usedCards,
    message: validation.message,
    heavyWarning,
    isCalculating,
    progressPct,
    result,
    currentHandLabel,
    drawInfo,
    setHeroCard,
    clearHeroCard,
    randomizeHero,
    setBoardCard,
    clearBoardFrom,
    addOpponent,
    removeOpponent,
    setOpponentMode,
    setOpponentCard,
    clearOpponentCard,
    randomizeOpponent,
    reset,
  };
}
