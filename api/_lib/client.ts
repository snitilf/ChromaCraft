// AI provider client. default is xAI (grok-4.20-0309-non-reasoning) over the OpenAI-compatible
// endpoint, so the already-installed openai SDK works with only a baseURL swap.
// AI_BASE_URL / AI_MODEL / AI_API_KEY let a different OpenAI-compatible provider
// (Groq, or any OpenAI-compatible endpoint) drop in without code changes.

import OpenAI from 'openai';

export const DEFAULT_BASE_URL = 'https://api.x.ai/v1';
export const DEFAULT_MODEL = 'grok-4.20-0309-non-reasoning';
const REQUEST_TIMEOUT_MS = 25_000;

// thrown when no key is configured. the handler maps this to a 500 config error
// so it stays distinct from provider/transport failures (502).
export class ConfigError extends Error {
  constructor(message = 'AI provider is not configured') {
    super(message);
    this.name = 'ConfigError';
  }
}

export function getApiKey(): string | undefined {
  return process.env.XAI_API_KEY ?? process.env.AI_API_KEY;
}

export function getModel(): string {
  return process.env.AI_MODEL ?? DEFAULT_MODEL;
}

export function getClient(): OpenAI {
  const apiKey = getApiKey();
  if (!apiKey) throw new ConfigError();
  const baseURL = process.env.AI_BASE_URL ?? DEFAULT_BASE_URL;
  return new OpenAI({ apiKey, baseURL, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
}
