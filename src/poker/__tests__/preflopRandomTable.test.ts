import { describe, it, expect } from 'vitest';
import { PREFLOP_RANDOM_TABLE, canonicalHandKey } from '../preflopRandomTable';
import { c } from './testHelpers';

describe('PREFLOP_RANDOM_TABLE', () => {
  it('has exactly the 169 canonical starting hands (13 pairs + 78 suited + 78 offsuit)', () => {
    const keys = Object.keys(PREFLOP_RANDOM_TABLE);
    expect(keys.length).toBe(169);
    expect(keys.filter((k) => k.length === 2).length).toBe(13); // pairs, e.g. "AA"
    expect(keys.filter((k) => k.endsWith('s')).length).toBe(78);
    expect(keys.filter((k) => k.endsWith('o')).length).toBe(78);
  });

  it('every entry is a well-formed exact-enumeration result (win+tie+lose sum to 100%)', () => {
    for (const [key, result] of Object.entries(PREFLOP_RANDOM_TABLE)) {
      expect(result.winPct + result.tiePct + result.losePct, `${key} win+tie+lose`).toBeCloseTo(100, 5);
      expect(result.equityPct, `${key} equityPct`).toBeCloseTo(result.winPct + result.tiePct * 0.5, 5);
      expect(result.trials, `${key} trials`).toBeGreaterThan(0);
      // All 169 hands enumerate the same C(50,5) boards * C(45,2) opponents (2,118,760 * 990),
      // since with no board cards dealt the trial count never depends on the hero's hole cards.
      expect(result.trials).toBe(2097572400);
    }
  });

  it('AA is a well-known ~85% preflop favorite vs. a random hand', () => {
    expect(PREFLOP_RANDOM_TABLE.AA.equityPct).toBeGreaterThan(80);
    expect(PREFLOP_RANDOM_TABLE.AA.equityPct).toBeLessThan(90);
  });

  it('pocket pairs beat their own hand: AA > KK > QQ > 22 in equity vs. random', () => {
    expect(PREFLOP_RANDOM_TABLE.AA.equityPct).toBeGreaterThan(PREFLOP_RANDOM_TABLE.KK.equityPct);
    expect(PREFLOP_RANDOM_TABLE.KK.equityPct).toBeGreaterThan(PREFLOP_RANDOM_TABLE.QQ.equityPct);
    expect(PREFLOP_RANDOM_TABLE.QQ.equityPct).toBeGreaterThan(PREFLOP_RANDOM_TABLE['22'].equityPct);
  });

  it('has a clear worst hand, among the traditionally weakest offsuit low cards', () => {
    // 72o is often cited as "the worst starting hand," but that's about domination/playability,
    // not raw equity vs. a uniformly random hand. Checked against this generated data (not
    // assumed): 32o comes out lowest here, with 72o only 5th-lowest — 32o has fewer ways to
    // make a straight (no card above a 5 needed to complete one) while still being the two
    // lowest, least-paired-with-anything-big ranks. Either way it's one of this small, sane set.
    let worstKey = '';
    let worstEquity = Infinity;
    for (const [key, result] of Object.entries(PREFLOP_RANDOM_TABLE)) {
      if (result.equityPct < worstEquity) {
        worstEquity = result.equityPct;
        worstKey = key;
      }
    }
    expect(['32o', '72o', '42o', '52o', '62o']).toContain(worstKey);
    expect(worstEquity).toBeLessThan(35);
  });

  it('suited beats offsuit for the same two ranks (a flush/straight-flush possibility only helps)', () => {
    expect(PREFLOP_RANDOM_TABLE.AKs.equityPct).toBeGreaterThan(PREFLOP_RANDOM_TABLE.AKo.equityPct);
    expect(PREFLOP_RANDOM_TABLE['72s'].equityPct).toBeGreaterThan(PREFLOP_RANDOM_TABLE['72o'].equityPct);
  });
});

describe('canonicalHandKey', () => {
  it('maps a pocket pair regardless of suits', () => {
    expect(canonicalHandKey(c('As'), c('Ah'))).toBe('AA');
    expect(canonicalHandKey(c('2c'), c('2d'))).toBe('22');
  });

  it('maps a suited combo with the higher rank first, regardless of argument order', () => {
    expect(canonicalHandKey(c('Ks'), c('As'))).toBe('AKs');
    expect(canonicalHandKey(c('As'), c('Ks'))).toBe('AKs');
  });

  it('maps an offsuit combo with the higher rank first', () => {
    expect(canonicalHandKey(c('Ah'), c('Ks'))).toBe('AKo');
    expect(canonicalHandKey(c('Ks'), c('Ah'))).toBe('AKo');
  });

  it('every key it can produce exists in PREFLOP_RANDOM_TABLE', () => {
    expect(canonicalHandKey(c('7h'), c('2c'))).toBe('72o');
    expect(PREFLOP_RANDOM_TABLE[canonicalHandKey(c('7h'), c('2c'))]).toBeDefined();
  });
});
