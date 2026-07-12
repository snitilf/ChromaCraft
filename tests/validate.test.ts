import { describe, it, expect } from 'vitest';
import { contrastRatio, hexToHsl } from '../api/_lib/color';
import {
  autoCorrect,
  checkRetryIssues,
  effectiveMode,
  forceCorrect,
  toClientPalette,
  type InternalPalette,
} from '../api/_lib/validate';

function base(overrides: Partial<InternalPalette> = {}): InternalPalette {
  return {
    primary: '#0A2540',
    secondary: '#334E68',
    accent: '#635BFF',
    background: '#F6F9FC',
    surface: '#FFFFFF',
    mode: 'light',
    ...overrides,
  };
}

describe('effectiveMode', () => {
  it('derives dark from measured background lightness, ignoring model mode', () => {
    // model declared light, but a #121212 background is measurably dark
    expect(effectiveMode('#121212', 'generic')).toBe('dark');
  });

  it('a dark-prompt palette keeps a dark background regardless of category', () => {
    expect(effectiveMode('#121212', 'saas')).toBe('dark');
    expect(effectiveMode('#0E0E0E', 'fintech')).toBe('dark');
  });

  it('light background is light', () => {
    expect(effectiveMode('#F6F9FC', 'generic')).toBe('light');
  });

  it('mid background falls back to category default then lightness', () => {
    // masculine defaults to dark even at a mid background
    expect(effectiveMode('#808080', 'masculine')).toBe('dark');
    // no default: mid-low lightness reads dark, mid-high reads light
    expect(effectiveMode('#3A3A3A', 'generic')).toBe('dark');
  });
});

describe('checkRetryIssues', () => {
  it('flags a red accent for fintech', () => {
    const issues = checkRetryIssues(base({ accent: '#E01E37' }), 'fintech', 'light');
    expect(issues).toContain('fintechRed');
  });

  it('does not flag the electric violet accent as red', () => {
    const issues = checkRetryIssues(base(), 'fintech', 'light');
    expect(issues).not.toContain('fintechRed');
  });

  it('flags a purple color for masculine', () => {
    const issues = checkRetryIssues(
      base({ accent: '#8A2BE2', background: '#121212', mode: 'dark' }),
      'masculine',
      'dark'
    );
    expect(issues).toContain('masculineHue');
  });
});

describe('autoCorrect', () => {
  it('replaces a pure black background with #121212', () => {
    const { palette, applied } = autoCorrect(
      base({ background: '#000000', mode: 'dark', primary: '#EEEEEE', surface: '#1A1A1A' }),
      'generic',
      'dark'
    );
    expect(palette.background).toBe('#121212');
    expect(applied).toContain('pureBlack');
  });

  it('darkens a coral accent until it holds white button text', () => {
    // #FF7F50 vs white is about 2.5:1, below the 3:1 large-text bar
    expect(contrastRatio('#FF7F50', '#FFFFFF')).toBeLessThan(3);
    const { palette, applied } = autoCorrect(base({ accent: '#FF7F50' }), 'saas', 'light');
    expect(applied).toContain('accentWhite');
    expect(contrastRatio(palette.accent, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    // hue is preserved (still a coral/orange), only lightness moved
    expect(hexToHsl(palette.accent).h).toBeCloseTo(hexToHsl('#FF7F50').h, 0);
  });

  it('caps saturation on non-accent luxury colors', () => {
    const { palette, applied } = autoCorrect(
      base({ secondary: '#0055FF', accent: '#A57A03' }),
      'luxury',
      'light'
    );
    expect(applied).toContain('luxurySat');
    expect(hexToHsl(palette.secondary).s).toBeLessThanOrEqual(30 + 0.5);
    // accent is exempt from the cap
    expect(palette.accent).toBe('#A57A03');
  });

  it('fixes low primary/background contrast', () => {
    const { palette } = autoCorrect(
      base({ primary: '#E8EEF5', background: '#F6F9FC' }),
      'generic',
      'light'
    );
    expect(contrastRatio(palette.primary, palette.background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('forceCorrect', () => {
  it('clamps a mid background toward the effective mode', () => {
    const mode = effectiveMode('#7A7A7A', 'generic'); // mid lightness with no default
    const out = forceCorrect(base({ background: '#7A7A7A', mode }), 'generic', mode);
    const bgL = hexToHsl(out.background).l;
    if (mode === 'light') expect(bgL).toBeGreaterThanOrEqual(90);
    else expect(bgL).toBeLessThanOrEqual(15);
  });

  it('remaps a masculine purple out of the forbidden band', () => {
    const out = forceCorrect(
      base({ secondary: '#C71585', background: '#121212', surface: '#1C1C1C', primary: '#E6EDF3', mode: 'dark' }),
      'masculine',
      'dark'
    );
    const h = hexToHsl(out.secondary).h;
    expect(h < 270 || h > 345).toBe(true);
  });

  it('never leaves a fintech accent in the red band, even when the +180 complement lands there', () => {
    // teal secondary: fintech red-remap -> violet 270, then +180 from teal (~176)
    // lands near red (~356). the final fintech guard must pull it back out.
    const out = forceCorrect(
      base({ accent: '#E01E37', secondary: '#00B3A6', background: '#F6F9FC', mode: 'light' }),
      'fintech',
      'light'
    );
    const acc = hexToHsl(out.accent);
    const inRed = ((acc.h % 360) + 360) % 360 >= 340 || ((acc.h % 360) + 360) % 360 <= 20;
    expect(acc.s >= 20 && inRed).toBe(false);
  });

  it('always yields readable primary text', () => {
    const out = forceCorrect(
      base({ primary: '#CCCCCC', background: '#DDDDDD', mode: 'light' }),
      'generic',
      'light'
    );
    expect(contrastRatio(out.primary, out.background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('toClientPalette', () => {
  it('strips mode and any extra keys, leaving exactly five', () => {
    const withExtra = { ...base(), mode: 'dark' as const, junk: 'x' } as unknown as InternalPalette;
    const client = toClientPalette(withExtra);
    expect(Object.keys(client).sort()).toEqual(
      ['accent', 'background', 'primary', 'secondary', 'surface'].sort()
    );
    expect('mode' in client).toBe(false);
  });
});
