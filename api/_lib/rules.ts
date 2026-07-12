// typed distillation of docs/color_research.txt. drives category detection, the
// per-category prompt snippet, and the few-shot style reference. the research
// text remains the source of truth; this is the machine-usable summary.

import type { Palette } from '../../types.js';

export type CategoryId = 'fintech' | 'masculine' | 'luxury' | 'saas' | 'generic';
export type Mode = 'light' | 'dark';

export interface Category {
  id: CategoryId;
  keywords: string[];
  defaultMode?: Mode;
  snippet: string;
  fewShot: Palette;
  fewShotNote: string;
}

// tie-break precedence when keyword scores are equal. earlier wins.
export const PRECEDENCE: CategoryId[] = ['fintech', 'masculine', 'luxury', 'saas'];

export const CATEGORIES: Record<CategoryId, Category> = {
  fintech: {
    id: 'fintech',
    keywords: [
      'fintech',
      'finance',
      'financial',
      'bank',
      'banking',
      'payment',
      'payments',
      'invoice',
      'invoicing',
      'billing',
      'wallet',
      'investment',
      'investing',
      'insurance',
      'accounting',
      'budget',
      'money',
      'dashboard',
      'enterprise',
      'corporate',
    ],
    snippet: [
      'category: fintech / financial. build trust.',
      '- secondary in the blue/navy band (hue 200-240), desaturated slate tones.',
      '- background light and near-neutral; deep navy (like #0A2540) for headers and text.',
      '- never use a red accent (red reads as debt/error in finance).',
      '- accent should be an electric violet or vibrant green, used only for primary actions.',
      '- keep it sober: no loud, playful color.',
    ].join('\n'),
    fewShot: {
      primary: '#0A2540',
      secondary: '#334E68',
      accent: '#635BFF',
      background: '#F6F9FC',
      surface: '#FFFFFF',
    },
    fewShotNote: 'Stripe-style: navy authority, blurple accent for CTAs only.',
  },
  masculine: {
    id: 'masculine',
    keywords: [
      'masculine',
      'developer',
      'terminal',
      'code',
      'coding',
      'engineer',
      'hacker',
      'crypto',
      'blockchain',
      'trading',
      'gaming',
      'gamer',
      'rugged',
      'tactical',
      'military',
      'sports',
      'fitness',
      'gym',
      'automotive',
    ],
    defaultMode: 'dark',
    snippet: [
      'category: masculine / developer / crypto. dark and technical.',
      '- dark mode by default: near-black background (like #121212), never pure black.',
      '- exclude purple and pink hues entirely (nothing in the 270-345 band).',
      '- prefer shades (hue + black) over tints; cool blues, teals, and greens read well.',
      '- accent stays high-contrast and restrained.',
      '- light text on the dark background must clear WCAG AA.',
    ].join('\n'),
    fewShot: {
      primary: '#E6EDF3',
      secondary: '#2F81F7',
      accent: '#3FB950',
      background: '#121212',
      surface: '#1C1C1C',
    },
    fewShotNote: 'Dark technical UI: cool blue secondary, green accent, no purple.',
  },
  luxury: {
    id: 'luxury',
    keywords: [
      'luxury',
      'luxurious',
      'premium',
      'high-end',
      'elegant',
      'elegance',
      'fashion',
      'couture',
      'boutique',
      'jewelry',
      'jewellery',
      'opulent',
      'sophisticated',
      'exclusive',
      'minimalist',
      'minimal',
      'refined',
      'artisan',
    ],
    snippet: [
      'category: luxury / minimalist / high-end. quiet and refined.',
      '- cap saturation at ~30% for every non-accent color; prefer tones (hue + grey).',
      '- warm neutral background: bone/ivory (like #F2EFEA), not pure white.',
      '- rich black (like #0D0D0D) instead of pure black for text.',
      '- a single metallic accent (muted gold like #A57A03) as jewelry.',
      '- restraint over vibrancy.',
    ].join('\n'),
    fewShot: {
      primary: '#0D0D0D',
      secondary: '#4A4640',
      accent: '#A57A03',
      background: '#F2EFEA',
      surface: '#FBFAF7',
    },
    fewShotNote: 'Bone background, rich black type, a touch of muted gold.',
  },
  saas: {
    id: 'saas',
    keywords: [
      'saas',
      'startup',
      'tech',
      'software',
      'app',
      'platform',
      'product',
      'growth',
      'cloud',
      'productivity',
      'collaboration',
      'workflow',
      'modern',
      'vibrant',
      'onboarding',
      'analytics',
    ],
    snippet: [
      'category: modern saas / startup. energetic and clear.',
      '- pair a cool secondary (teal/blue) with a warm accent (coral/orange) for conversion.',
      '- clean light background, generous whitespace.',
      '- vibrant but still WCAG AA for text on background and surface.',
      '- accent must remain legible with white button text.',
      '- avoid pairing teal with green (too low contrast).',
    ].join('\n'),
    fewShot: {
      primary: '#1A2B3C',
      secondary: '#00A9E0',
      accent: '#E85D2A',
      background: '#FFFFFF',
      surface: '#F5F8FA',
    },
    fewShotNote: 'Cool teal secondary, warm coral accent darkened to hold white text.',
  },
  generic: {
    id: 'generic',
    keywords: [],
    snippet: [
      'category: general purpose. no strong industry constraints.',
      '- follow the base rules: 60-30-10, WCAG AA contrast, complementary accent.',
      '- pick a cohesive, tasteful scheme that fits the described mood.',
      '- keep the background near-neutral and let the accent do the work.',
    ].join('\n'),
    fewShot: {
      primary: '#2D2A32',
      secondary: '#4C6E5D',
      accent: '#E0863A',
      background: '#F7F5F2',
      surface: '#FFFFFF',
    },
    fewShotNote: 'Style reference only, not a template: adapt hues to the described mood.',
  },
};

// keyword scoring: count hits per category, highest wins, ties broken by
// PRECEDENCE, zero hits anywhere -> generic.
export function detectCategory(description: string): CategoryId {
  const text = description.toLowerCase();
  const scores = new Map<CategoryId, number>();
  for (const cat of Object.values(CATEGORIES)) {
    if (cat.keywords.length === 0) continue;
    let score = 0;
    for (const kw of cat.keywords) {
      // word-ish boundary match so "app" doesn't fire inside "apple"
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(kw)}([^a-z0-9]|$)`, 'i');
      if (re.test(text)) score += 1;
    }
    if (score > 0) scores.set(cat.id, score);
  }
  if (scores.size === 0) return 'generic';
  let best: CategoryId = 'generic';
  let bestScore = 0;
  for (const id of PRECEDENCE) {
    const s = scores.get(id) ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = id;
    }
  }
  return best;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
