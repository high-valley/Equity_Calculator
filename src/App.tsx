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
import { SettingsButton } from './components/SettingsButton';
import { usePokerCalculator } from './hooks/usePokerCalculator';
import { useBgm } from './hooks/useBgm';
import type { Card } from './poker/types';

type PickerTarget =
  | { kind: 'hero'; index: 0 | 1 }
  | { kind: 'opponent'; oppIndex: number; index: 0 | 1 }
  | { kind: 'board'; index: number }
  | null;

function App() {
  const calc = usePokerCalculator();
  const bgm = useBgm();
  const [picker, setPicker] = useState<PickerTarget>(null);

  const usedCardIds = new Set(calc.usedCards.map((c) => c.id));

  function currentCardIdFor(target: PickerTarget): string | undefined {
    if (!target) return undefined;
    if (target.kind === 'hero') return calc.heroSlots[target.index]?.id;
    if (target.kind === 'opponent') return calc.opponents[target.oppIndex]?.slots[target.index]?.id;
    return calc.boardCards[target.index]?.id;
  }

  function handleSelect(card: Card): void {
    if (!picker) return;
    if (picker.kind === 'hero') calc.setHeroCard(picker.index, card);
    else if (picker.kind === 'opponent') calc.setOpponentCard(picker.oppIndex, picker.index, card);
    else calc.setBoardCard(picker.index, card);
    setPicker(null);
  }

  function handleClear(): void {
    if (!picker) return;
    if (picker.kind === 'hero') calc.clearHeroCard(picker.index);
    else if (picker.kind === 'opponent') calc.clearOpponentCard(picker.oppIndex, picker.index);
    else calc.clearBoardFrom(picker.index);
    setPicker(null);
  }

  function pickerTitle(target: PickerTarget): string {
    if (!target) return '';
    if (target.kind === 'hero') return 'あなたのカードを選択';
    if (target.kind === 'board') return 'ボードのカードを選択';
    return calc.opponents.length > 1 ? `相手${target.oppIndex + 1}のカードを選択` : '相手のカードを選択';
  }

  const hasCurrentCard = Boolean(picker && currentCardIdFor(picker));

  return (
    <div className="app-shell">
      <header className="app-header">
        <SettingsButton bgmEnabled={bgm.enabled} onToggleBgm={bgm.toggle} />
        <h1>
          テキサスホールデム
          <br />
          勝率計算機
        </h1>
      </header>

      <PhaseIndicator phase={calc.phase} />

      <HandSelector
        title="あなたの手札"
        slots={calc.heroSlots}
        onOpen={(index) => setPicker({ kind: 'hero', index: index as 0 | 1 })}
        onRandomize={calc.randomizeHero}
      />

      <Board cards={calc.boardCards} onOpen={(index) => setPicker({ kind: 'board', index })} />

      <OpponentSelector
        opponents={calc.opponents}
        maxOpponents={calc.maxOpponents}
        onModeChange={calc.setOpponentMode}
        onOpenSlot={(oppIndex, index) => setPicker({ kind: 'opponent', oppIndex, index })}
        onAdd={calc.addOpponent}
        onRemove={calc.removeOpponent}
      />

      {calc.heavyWarning && <p className="heavy-warning">⚠ {calc.heavyWarning}</p>}

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
          title={pickerTitle(picker)}
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
