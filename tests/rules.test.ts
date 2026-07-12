import { describe, it, expect } from 'vitest';
import { detectCategory, CATEGORIES } from '../api/_lib/rules';

describe('detectCategory', () => {
  it('detects fintech from finance keywords', () => {
    expect(detectCategory('trustworthy fintech dashboard')).toBe('fintech');
  });

  it('detects luxury from fashion keywords', () => {
    expect(detectCategory('luxury fashion house')).toBe('luxury');
  });

  it('detects masculine for a crypto trading terminal via keyword scores', () => {
    expect(detectCategory('crypto trading terminal')).toBe('masculine');
  });

  it('breaks a tie by precedence: fintech beats masculine and luxury', () => {
    expect(detectCategory('luxury fintech crypto')).toBe('fintech');
  });

  it('falls back to generic when nothing matches', () => {
    expect(detectCategory('cozy coffee shop')).toBe('generic');
  });

  it('does not fire on substrings (app inside apple)', () => {
    expect(detectCategory('an apple orchard in autumn')).toBe('generic');
  });
});

describe('category metadata', () => {
  it('only masculine defaults to dark mode', () => {
    expect(CATEGORIES.masculine.defaultMode).toBe('dark');
    expect(CATEGORIES.fintech.defaultMode).toBeUndefined();
    expect(CATEGORIES.luxury.defaultMode).toBeUndefined();
    expect(CATEGORIES.saas.defaultMode).toBeUndefined();
    expect(CATEGORIES.generic.defaultMode).toBeUndefined();
  });
});
