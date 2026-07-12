import { Palette } from '../types';

export const MAX_DESCRIPTION_LENGTH = 500;

const HEX = /^#[0-9A-Fa-f]{6}$/;
const GENERIC_FAILURE = 'Failed to generate palette. Please try again.';
const AUTH_STORAGE_KEY = 'chromacraft_auth_token';

// thrown on a 401 so the UI can detect it specifically and show the unlock link.
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    // localStorage can throw in private mode or when disabled
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, token);
  } catch {
    // if storage is unavailable the token just won't persist across reloads
  }
}

export const generatePalette = async (description: string): Promise<Palette> => {
  const trimmed = description.trim();
  if (!trimmed) {
    throw new Error('Please enter a description.');
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }

  // in production use the relative path; in dev the Vercel CLI serves the api on 3000.
  const apiUrl = import.meta.env.PROD
    ? '/api/generate-palette'
    : import.meta.env.VITE_API_URL || 'http://localhost:3000/api/generate-palette';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ description: trimmed }),
    });
  } catch {
    throw new Error(GENERIC_FAILURE);
  }

  if (!response.ok) {
    // 401 carries the server's authorized-users message verbatim; surface it as
    // a typed error so the UI can offer the unlock link.
    if (response.status === 401) {
      const data = await response.json().catch(() => null);
      throw new UnauthorizedError((data && data.error) || GENERIC_FAILURE);
    }
    // only surface the server message for our own safe 400/429 strings.
    if (response.status === 400 || response.status === 429) {
      const data = await response.json().catch(() => null);
      throw new Error((data && data.error) || GENERIC_FAILURE);
    }
    throw new Error(GENERIC_FAILURE);
  }

  const data = (await response.json().catch(() => null)) as Partial<Palette> | null;
  const keys: (keyof Palette)[] = ['primary', 'secondary', 'accent', 'background', 'surface'];
  if (!data || keys.some((k) => typeof data[k] !== 'string' || !HEX.test(data[k] as string))) {
    throw new Error(GENERIC_FAILURE);
  }

  return {
    primary: data.primary as string,
    secondary: data.secondary as string,
    accent: data.accent as string,
    background: data.background as string,
    surface: data.surface as string,
  };
};
