import { useEffect, useMemo, useRef, useState } from 'react';
import { describeHandJa, evaluateHand } from '../poker/evaluator';
import { analyzeDraws } from '../poker/outs';
import type { EquityComputeInput } from '../poker/equity';
import { canonicalHandKey, PREFLOP_RANDOM_TABLE } from '../poker/preflopRandomTable';
import type { Card, DrawInfo, EquityResultData, OpponentMode, Phase } from '../poker/types';
import type { EquityRequestMessage, EquityResponseMessage } from '../workers/equityWorker';

type Slot = Card | null;

function derivePhase(boardLen: number): Phase {
  if (boardLen >= 5) return 'river';
  if (boardLen >= 4) return 'turn';
  if (boardLen >= 3) return 'flop';
  return 'preflop';
}

function compact(slots: Slot[]): Card[] {
  return slots.filter((c): c is Card => c !== null);
}

interface Validation {
  ready: boolean;
  message: string | null;
  input?: EquityComputeInput;
}

function validate(hero: Card[], board: Card[], opponentMode: OpponentMode, opponentCards: Card[]): Validation {
  if (hero.length < 2) {
    return { ready: false, message: hero.length === 0 ? '手札を2枚選んでください。' : 'あと1枚選んでください。' };
  }
  if (![0, 3, 4, 5].includes(board.length)) {
    return { ready: false, message: 'フロップを完成させてください。' };
  }
  if (opponentMode === 'specific' && opponentCards.length < 2) {
    return {
      ready: false,
      message: opponentCards.length === 0 ? '相手のカードを2枚選んでください。' : '相手のカードをあと1枚選んでください。',
    };
  }
  return {
    ready: true,
    message: null,
    input: {
      heroCards: [hero[0], hero[1]],
      boardCards: board,
      opponent: opponentMode === 'random' ? { mode: 'random', cards: [] } : { mode: 'specific', cards: opponentCards },
    },
  };
}

export interface PokerCalculator {
  heroSlots: Slot[];
  boardCards: Card[];
  opponentMode: OpponentMode;
  opponentSlots: Slot[];
  phase: Phase;
  usedCards: Card[];
  message: string | null;
  isCalculating: boolean;
  progressPct: number | null;
  result: EquityResultData | null;
  currentHandLabel: string | null;
  drawInfo: DrawInfo;
  setHeroCard: (index: 0 | 1, card: Card) => void;
  clearHeroCard: (index: 0 | 1) => void;
  setBoardCard: (index: number, card: Card) => void;
  clearBoardFrom: (index: number) => void;
  setOpponentMode: (mode: OpponentMode) => void;
  setOpponentCard: (index: 0 | 1, card: Card) => void;
  clearOpponentCard: (index: 0 | 1) => void;
  reset: () => void;
}

export function usePokerCalculator(): PokerCalculator {
  const [heroSlots, setHeroSlots] = useState<Slot[]>([null, null]);
  const [boardCards, setBoardCards] = useState<Card[]>([]);
  const [opponentMode, setOpponentModeState] = useState<OpponentMode>('random');
  const [opponentSlots, setOpponentSlots] = useState<Slot[]>([null, null]);

  const [result, setResult] = useState<EquityResultData | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progressPct, setProgressPct] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const heroCards = useMemo(() => compact(heroSlots), [heroSlots]);
  const opponentCards = useMemo(() => compact(opponentSlots), [opponentSlots]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/equityWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<EquityResponseMessage>) => {
      const msg = event.data;
      if (msg.requestId !== requestIdRef.current) return; // superseded by a newer request
      if (msg.type === 'progress') {
        setProgressPct(msg.totalOuter > 0 ? Math.min(99, (msg.processedOuter / msg.totalOuter) * 100) : 0);
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

  const validation = useMemo(
    () => validate(heroCards, boardCards, opponentMode, opponentCards),
    [heroCards, boardCards, opponentMode, opponentCards],
  );

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

    const { heroCards: hero, boardCards: board, opponent } = validation.input;
    if (opponent.mode === 'random' && board.length === 0) {
      // Preflop vs. a fully random opponent is the one case exhaustive enumeration
      // is too slow for live computation (~2.1B combinations) — but the answer only
      // depends on the two hole card ranks and suitedness, so it's precomputed for
      // all 169 canonical starting hands (see preflopRandomTable.ts).
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
    () => [...heroCards, ...boardCards, ...(opponentMode === 'specific' ? opponentCards : [])],
    [heroCards, boardCards, opponentMode, opponentCards],
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

  function setOpponentMode(mode: OpponentMode): void {
    setOpponentModeState(mode);
    if (mode === 'random') setOpponentSlots([null, null]);
  }

  function setOpponentCard(index: 0 | 1, card: Card): void {
    setOpponentSlots((prev) => {
      const next = [...prev];
      next[index] = card;
      return next;
    });
  }

  function clearOpponentCard(index: 0 | 1): void {
    setOpponentSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  function reset(): void {
    setHeroSlots([null, null]);
    setBoardCards([]);
    setOpponentModeState('random');
    setOpponentSlots([null, null]);
  }

  return {
    heroSlots,
    boardCards,
    opponentMode,
    opponentSlots,
    phase: derivePhase(boardCards.length),
    usedCards,
    message: validation.message,
    isCalculating,
    progressPct,
    result,
    currentHandLabel,
    drawInfo,
    setHeroCard,
    clearHeroCard,
    setBoardCard,
    clearBoardFrom,
    setOpponentMode,
    setOpponentCard,
    clearOpponentCard,
    reset,
  };
}
