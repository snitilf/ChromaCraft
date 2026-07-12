// personal auth gate for the generate endpoint. this is a single shared static
// secret (AUTH_TOKEN), not real user accounts: anyone who has the token can
// generate. fine for a personal tool. fails closed: if AUTH_TOKEN is unset the
// endpoint denies everyone, including Filip, so a misconfiguration cannot
// silently open the endpoint.

import { createHash, timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function isAuthorized(authHeader: string | undefined, expected: string | undefined): boolean {
  // fail closed when no token is configured
  if (!expected) return false;
  if (!authHeader) return false;

  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) return false;

  const candidate = authHeader.slice(prefix.length);
  if (!candidate) return false;

  // hash both sides first so the buffers are always equal length (32 bytes),
  // which timingSafeEqual requires, and so the compare time does not leak the
  // token length.
  return timingSafeEqual(sha256(candidate), sha256(expected));
}

export function checkAuth(req: VercelRequest): boolean {
  const header = req.headers['authorization'];
  const authHeader = Array.isArray(header) ? header[0] : header;
  return isAuthorized(authHeader, process.env.AUTH_TOKEN);
}
