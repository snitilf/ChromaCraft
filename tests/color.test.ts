import { describe, it, expect } from 'vitest';
import {
  contrastRatio,
  hexToHsl,
  hexToRgb,
  hslToHex,
  hueDistance,
  normalizeHex,
  relativeLuminance,
} from '../api/_lib/color';

describe('contrastRatio', () => {
  it('black vs white is 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('#767677 vs white is about 4.54 (WCAG AA boundary)', () => {
    expect(contrastRatio('#767677', '#FFFFFF')).toBeCloseTo(4.54, 1);
  });

  it('is order-independent', () => {
    expect(contrastRatio('#0A2540', '#F6F9FC')).toBeCloseTo(
      contrastRatio('#F6F9FC', '#0A2540'),
      10
    );
  });
});

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 6);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
  });
});

describe('hex parsing and expansion', () => {
  it('normalizes 3-digit hex to uppercase 6-digit', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('fff')).toBe('#FFFFFF');
  });

  it('expands 3-digit hex when converting to rgb', () => {
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });
});

describe('hsl round-trips', () => {
  it('maps pure red to h=0 s=100 l=50 and back', () => {
    const hsl = hexToHsl('#FF0000');
    expect(hsl.h).toBeCloseTo(0, 5);
    expect(hsl.s).toBeCloseTo(100, 5);
    expect(hsl.l).toBeCloseTo(50, 5);
    expect(hslToHex(hsl)).toBe('#FF0000');
  });

  it('round-trips a mid color within rounding tolerance', () => {
    const start = '#3498DB';
    const round = hslToHex(hexToHsl(start));
    const a = hexToRgb(start);
    const b = hexToRgb(round);
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
  });
});

describe('hueDistance', () => {
  it('wraps around the wheel (350 vs 10 = 20)', () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(10, 350)).toBe(20);
  });

  it('caps at 180', () => {
    expect(hueDistance(0, 180)).toBe(180);
    expect(hueDistance(0, 270)).toBe(90);
  });
});
