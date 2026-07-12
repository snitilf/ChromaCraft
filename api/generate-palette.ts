import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from './_lib/ratelimit.js';
import { runPipeline } from './_lib/pipeline.js';
import { ConfigError } from './_lib/client.js';
import { MAX_DESCRIPTION_LENGTH } from './_lib/prompt.js';

// first x-forwarded-for entry is the client on Vercel's edge. missing -> the
// shared "unknown" bucket in the limiter, never unlimited.
function getClientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  const first = raw ? raw.split(',')[0].trim() : '';
  return first || 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rl = checkRateLimit(getClientIp(req));
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' });
  }

  const body: unknown = req.body;
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { description?: unknown }).description !== 'string'
  ) {
    return res.status(400).json({ error: 'A text description is required.' });
  }

  const trimmed = (body as { description: string }).description.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'Description cannot be empty.' });
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return res
      .status(400)
      .json({ error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` });
  }

  try {
    const { palette } = await runPipeline(trimmed);
    // response allowlist: exactly the five hex fields, no mode, no extras.
    return res.status(200).json(palette);
  } catch (err) {
    // config problem (no key) is a 500; provider/parse/timeout is a transport 502.
    if (err instanceof ConfigError) {
      console.error('generate-palette not configured');
      return res.status(500).json({ error: 'Palette generation is not configured.' });
    }
    console.error('generate-palette failed:', err);
    return res.status(502).json({ error: 'Palette generation failed. Please try again.' });
  }
}
