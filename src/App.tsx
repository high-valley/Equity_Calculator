import { useState } from 'react';
import { PhaseIndicator } from './components/PhaseIndicator';
import { HandSelector } from './components/HandSelector';
import { Board } from './components/Board';
import { OpponentSelector } from './components/OpponentSelector';
import { EquityResult } from './components/EquityResult';
import { HandResult } from './components/HandResult';
import { DrawResult } from './components/DrawResult';
import { ResetButton } from './components/ResetButton';
import { CardPicker } from './components/CardPicker';
import { VersionFooter } from './components/VersionFooter';
import { usePokerCalculator } from './hooks/usePokerCalculator';
import type { Card } from './poker/types';

type PickerKind = 'hero' | 'opponent' | 'board';
type PickerTarget = { kind: 'hero' | 'opponent'; index: 0 | 1 } | { kind: 'board'; index: number } | null;

function App() {
  const calc = usePokerCalculator();
  const [picker, setPicker] = useState<PickerTarget>(null);

  const usedCardIds = new Set(calc.usedCards.map((c) => c.id));

  function currentCardIdFor(target: PickerTarget): string | undefined {
    if (!target) return undefined;
    if (target.kind === 'hero') return calc.heroSlots[target.index]?.id;
    if (target.kind === 'opponent') return calc.opponentSlots[target.index]?.id;
    return calc.boardCards[target.index]?.id;
  }

  function handleSelect(card: Card): void {
    if (!picker) return;
    if (picker.kind === 'hero') calc.setHeroCard(picker.index, card);
    else if (picker.kind === 'opponent') calc.setOpponentCard(picker.index, card);
    else calc.setBoardCard(picker.index, card);
    setPicker(null);
  }

  function handleClear(): void {
    if (!picker) return;
    if (picker.kind === 'hero') calc.clearHeroCard(picker.index);
    else if (picker.kind === 'opponent') calc.clearOpponentCard(picker.index);
    else calc.clearBoardFrom(picker.index);
    setPicker(null);
  }

  const pickerTitles: Record<PickerKind, string> = {
    hero: 'あなたのカードを選択',
    board: 'ボードのカードを選択',
    opponent: '相手のカードを選択',
  };

  const hasCurrentCard = Boolean(picker && currentCardIdFor(picker));

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>
          テキサスホールデム
          <br />
          勝率計算機
        </h1>
      </header>

      <PhaseIndicator phase={calc.phase} />

      <HandSelector title="あなたの手札" slots={calc.heroSlots} onOpen={(index) => setPicker({ kind: 'hero', index: index as 0 | 1 })} />

      <Board cards={calc.boardCards} onOpen={(index) => setPicker({ kind: 'board', index })} />

      <OpponentSelector
        mode={calc.opponentMode}
        slots={calc.opponentSlots}
        onModeChange={calc.setOpponentMode}
        onOpenSlot={(index) => setPicker({ kind: 'opponent', index })}
      />

      <EquityResult
        result={calc.result}
        isCalculating={calc.isCalculating}
        progressPct={calc.progressPct}
        blocked={!calc.result && !calc.isCalculating}
        message={calc.message}
      />

      <HandResult label={calc.currentHandLabel} />
      <DrawResult draw={calc.drawInfo} />

      <ResetButton onReset={calc.reset} />
      <VersionFooter />

      {picker && (
        <CardPicker
          title={pickerTitles[picker.kind]}
          usedCardIds={usedCardIds}
          currentCardId={currentCardIdFor(picker)}
          onSelect={handleSelect}
          onClear={hasCurrentCard ? handleClear : undefined}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

export default App;
