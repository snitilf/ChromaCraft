// deterministic palette validation and correction. every contrast decision is
// measured with contrastRatio (WCAG), never guessed from hsl lightness alone.
// autoCorrect makes mood-preserving fixes; checkRetryIssues reports problems
// that warrant a model retry; forceCorrect is the last-resort clamp so the
// endpoint can always return a valid palette.

import {
  contrastRatio,
  hexToHsl,
  hslToHex,
  hueDistance,
  normalizeHex,
  relativeLuminance,
} from './color.js';
import { CATEGORIES, type CategoryId, type Mode } from './rules.js';
import type { Palette } from '../../types.js';

export interface InternalPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  mode: Mode;
}

const TEXT_CONTRAST = 4.5;
const LARGE_CONTRAST = 3; // large/bold UI text (WCAG AA)
const SURFACE_DELTA_L = 3; // deliberately lenient
const HUE_SEP = 135;
// fintech deliberately pairs navy with electric violet (the stripe pattern from
// the research), which is only ~57 degrees of separation. saliency there comes
// from lightness/saturation contrast, so the hue bar is much lower.
const FINTECH_HUE_SEP = 45;

function minHueSep(category: CategoryId): number {
  return category === 'fintech' ? FINTECH_HUE_SEP : HUE_SEP;
}
const HUE_SKIP_SAT = 12; // skip hue checks on near-grey colors
const LUXURY_SAT_CAP = 30;
const WHITE = '#FFFFFF';

// measured background luminance below this reads as "dark bg" for choosing the
// direction to push text; it is the WCAG luminance midpoint-ish, not hsl l.
const DARK_BG_LUM = 0.18;

// background is trusted only through its measured lightness, never the model's
// declared mode. masculine is the only category that defaults to dark.
export function effectiveMode(background: string, category: CategoryId): Mode {
  const l = hexToHsl(background).l;
  if (l <= 15) return 'dark';
  if (l >= 90) return 'light';
  const def = CATEGORIES[category].defaultMode;
  if (def) return def;
  return l < 50 ? 'dark' : 'light';
}

function inRedBand(hue: number): boolean {
  const h = ((hue % 360) + 360) % 360;
  return h >= 340 || h <= 20;
}

function clampSaturation(hex: string, cap: number): string {
  const { h, s, l } = hexToHsl(hex);
  return s > cap ? hslToHex({ h, s: cap, l }) : hex;
}

// adjust a color's lightness (hue/sat preserved) until it clears target
// contrast against bg. binary search variable is l; the objective is the
// measured ratio. falls back to a near-black/near-white neutral per mode.
function findReadable(color: string, bg: string, target: number, mode: Mode): string {
  const { h, s, l } = hexToHsl(color);
  const preferDir = relativeLuminance(bg) > DARK_BG_LUM ? -1 : 1;
  const scan = (dir: number): string | null => {
    for (let cl = l; cl >= 0 && cl <= 100; cl += dir) {
      const c = hslToHex({ h, s, l: cl });
      if (contrastRatio(c, bg) >= target) return c;
    }
    return null;
  };
  return scan(preferDir) ?? scan(-preferDir) ?? (mode === 'dark' ? '#F5F5F5' : '#1A1A1A');
}

// darken an accent (hue/sat preserved) until it holds white text.
function fitWhiteText(accent: string): string {
  const { h, s, l } = hexToHsl(accent);
  for (let cl = l; cl >= 0; cl--) {
    const c = hslToHex({ h, s, l: cl });
    if (contrastRatio(c, WHITE) >= LARGE_CONTRAST) return c;
  }
  return hslToHex({ h, s, l: 0 });
}

export function autoCorrect(
  p: InternalPalette,
  category: CategoryId,
  mode: Mode
): { palette: InternalPalette; applied: string[] } {
  const applied: string[] = [];
  let { primary, secondary, accent, background, surface } = p;

  if (normalizeHex(background) === '#000000') {
    background = '#121212';
    applied.push('pureBlack');
  }

  if (category === 'luxury') {
    const before = [primary, secondary, background, surface].join();
    primary = clampSaturation(primary, LUXURY_SAT_CAP);
    secondary = clampSaturation(secondary, LUXURY_SAT_CAP);
    background = clampSaturation(background, LUXURY_SAT_CAP);
    surface = clampSaturation(surface, LUXURY_SAT_CAP);
    if ([primary, secondary, background, surface].join() !== before) applied.push('luxurySat');
  }

  // surface distinguishable from background (lenient)
  {
    const bgL = hexToHsl(background).l;
    const surf = hexToHsl(surface);
    if (Math.abs(surf.l - bgL) < SURFACE_DELTA_L) {
      const newL = bgL >= 50 ? Math.max(0, bgL - 4) : Math.min(100, bgL + 4);
      surface = hslToHex({ h: surf.h, s: surf.s, l: newL });
      applied.push('surfaceBg');
    }
  }

  // primary text vs background
  if (contrastRatio(primary, background) < TEXT_CONTRAST) {
    primary = findReadable(primary, background, TEXT_CONTRAST, mode);
    applied.push('primaryBg');
  }

  // primary text vs surface: primary is now pinned to background, so move surface
  if (contrastRatio(primary, surface) < TEXT_CONTRAST) {
    surface = findReadable(surface, primary, TEXT_CONTRAST, mode);
    applied.push('primarySurface');
  }

  // accent as a solid button holds white text
  if (contrastRatio(accent, WHITE) < LARGE_CONTRAST) {
    accent = fitWhiteText(accent);
    applied.push('accentWhite');
  }

  return { palette: { primary, secondary, accent, background, surface, mode }, applied };
}

// problems that warrant a model retry (not fixable while preserving the mood).
export function checkRetryIssues(p: InternalPalette, category: CategoryId, mode: Mode): string[] {
  const issues: string[] = [];
  const bgL = hexToHsl(p.background).l;

  if (mode === 'light' ? bgL < 90 : bgL > 15) issues.push('bgLuminosity');

  const sec = hexToHsl(p.secondary);
  const acc = hexToHsl(p.accent);

  if (sec.s >= HUE_SKIP_SAT && acc.s >= HUE_SKIP_SAT && hueDistance(acc.h, sec.h) < minHueSep(category)) {
    issues.push('accentSecondaryHue');
  }

  if (category === 'fintech') {
    if (acc.s >= 30 && inRedBand(acc.h)) issues.push('fintechRed');
    if (sec.s >= 15 && !(sec.h >= 200 && sec.h <= 240)) issues.push('fintechSecondary');
  }

  if (category === 'masculine') {
    const forbidden = [p.primary, p.secondary, p.accent, p.background, p.surface].some((c) => {
      const { h, s } = hexToHsl(c);
      return s >= 15 && h >= 270 && h <= 345;
    });
    if (forbidden) issues.push('masculineHue');
  }

  return issues;
}

// human-readable retry feedback for the model, derived from issue keys.
export function describeIssues(issues: string[]): string[] {
  const map: Record<string, string> = {
    bgLuminosity:
      'the background lightness is wrong for the mode: use hsl lightness >= 90 for light or <= 15 for dark.',
    accentSecondaryHue:
      'the accent is not complementary to the secondary: put them roughly opposite on the color wheel.',
    fintechRed: 'the accent is red, which is forbidden in finance; use electric violet or vibrant green.',
    fintechSecondary: 'the secondary must be in the blue/navy hue band (200-240).',
    masculineHue: 'remove all purple/pink; use cool blues, teals, or greens instead.',
  };
  return issues.map((k) => map[k]).filter((v): v is string => Boolean(v));
}

// last resort: a fixed sequence so remaps do not undo each other, then a final
// measured contrast pass. always yields a valid palette.
export function forceCorrect(p: InternalPalette, category: CategoryId, mode: Mode): InternalPalette {
  let { primary, secondary, accent, background, surface } = p;

  if (normalizeHex(background) === '#000000') background = '#121212';

  {
    const bg = hexToHsl(background);
    if (mode === 'light' ? bg.l < 90 : bg.l > 15) {
      background = hslToHex({ h: bg.h, s: bg.s, l: mode === 'light' ? 92 : 10 });
    }
  }

  if (category === 'masculine') {
    const remap = (hex: string): string => {
      const { h, s, l } = hexToHsl(hex);
      if (s >= 15 && h >= 270 && h <= 345) return hslToHex({ h: 210, s, l });
      return hex;
    };
    primary = remap(primary);
    secondary = remap(secondary);
    accent = remap(accent);
    background = remap(background);
    surface = remap(surface);
  }

  if (category === 'fintech') {
    const acc = hexToHsl(accent);
    if (acc.s >= 20 && inRedBand(acc.h)) accent = hslToHex({ h: 270, s: acc.s, l: acc.l });
  }

  {
    const sec = hexToHsl(secondary);
    const acc = hexToHsl(accent);
    if (sec.s >= HUE_SKIP_SAT && acc.s >= HUE_SKIP_SAT && hueDistance(acc.h, sec.h) < minHueSep(category)) {
      accent = hslToHex({ h: (sec.h + 180) % 360, s: acc.s, l: acc.l });
    }
  }

  // the +180 step can land a fintech accent back in the red band (e.g. teal
  // secondary -> complement near red). for fintech the no-red rule wins, so
  // re-apply it last and pull the accent to electric violet.
  if (category === 'fintech') {
    const acc = hexToHsl(accent);
    if (acc.s >= 20 && inRedBand(acc.h)) accent = hslToHex({ h: 270, s: acc.s, l: acc.l });
  }

  return autoCorrect({ primary, secondary, accent, background, surface, mode }, category, mode).palette;
}

// response allowlist: exactly the five hex fields, no mode, no extras.
export function toClientPalette(p: InternalPalette): Palette {
  return {
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
    background: p.background,
    surface: p.surface,
  };
}
