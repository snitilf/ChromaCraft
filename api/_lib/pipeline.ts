// generation pipeline: detect category -> model call (strict json_schema with a
// json_object fallback) -> deterministic validate/correct -> one retry with
// feedback -> force-correct. once a parseable, hex-valid palette exists the
// pipeline never fails on quality; only parse/schema/timeout/upstream failures
// propagate (the handler turns those into 502).

import OpenAI from 'openai';
import { getClient, getModel } from './client.js';
import { isHex6, normalizeHex } from './color.js';
import { buildMessages, PALETTE_JSON_SCHEMA } from './prompt.js';
import { detectCategory } from './rules.js';
import type { Mode } from './rules.js';
import {
  autoCorrect,
  checkRetryIssues,
  describeIssues,
  effectiveMode,
  forceCorrect,
  toClientPalette,
  type InternalPalette,
} from './validate.js';
import type { Palette } from '../../types.js';

export interface PipelineMeta {
  category: string;
  retried: boolean;
  forced: boolean;
  durationMs: number;
  issueKeys: string[];
}

export interface PipelineResult {
  palette: Palette;
  meta: PipelineMeta;
}

function isBadRequest(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { status?: number }).status === 400;
}

function parsePalette(content: string | null | undefined): InternalPalette {
  if (!content) throw new Error('empty model response');
  let text = content.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('model response was not valid JSON');
  }
  const keys = ['primary', 'secondary', 'accent', 'background', 'surface'] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const raw = obj[k];
    if (typeof raw !== 'string') throw new Error(`missing color: ${k}`);
    const hex = normalizeHex(raw);
    if (!isHex6(hex)) throw new Error(`invalid color: ${k}`);
    out[k] = hex;
  }
  const mode: Mode = obj.mode === 'dark' ? 'dark' : 'light';
  return {
    primary: out.primary,
    secondary: out.secondary,
    accent: out.accent,
    background: out.background,
    surface: out.surface,
    mode,
  };
}

async function callModel(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<InternalPalette> {
  const base = { model, messages, temperature: 0.7, max_tokens: 1024 };
  let content: string | null | undefined;
  try {
    const r = await client.chat.completions.create({
      ...base,
      response_format: { type: 'json_schema', json_schema: PALETTE_JSON_SCHEMA },
    });
    content = r.choices[0]?.message?.content;
  } catch (e) {
    // some providers reject strict json_schema; fall back to json_object mode.
    if (isBadRequest(e)) {
      const r = await client.chat.completions.create({
        ...base,
        response_format: { type: 'json_object' },
      });
      content = r.choices[0]?.message?.content;
    } else {
      throw e;
    }
  }
  return parsePalette(content);
}

export async function runPipeline(description: string): Promise<PipelineResult> {
  const start = Date.now();
  const category = detectCategory(description);
  const client = getClient();
  const model = getModel();

  let palette = await callModel(
    client,
    model,
    buildMessages(description, category) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  );
  let mode = effectiveMode(palette.background, category);
  palette = autoCorrect(palette, category, mode).palette;
  let issues = checkRetryIssues(palette, category, mode);

  let retried = false;
  let forced = false;

  if (issues.length > 0) {
    retried = true;
    try {
      let retryPalette = await callModel(
        client,
        model,
        buildMessages(description, category, describeIssues(issues)) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
      );
      const retryMode = effectiveMode(retryPalette.background, category);
      retryPalette = autoCorrect(retryPalette, category, retryMode).palette;
      palette = retryPalette;
      mode = retryMode;
      issues = checkRetryIssues(retryPalette, category, retryMode);
    } catch {
      // a transient retry failure must not discard the usable first palette;
      // fall through to deterministic force-correction.
    }
  }

  if (issues.length > 0) {
    forced = true;
    palette = forceCorrect(palette, category, mode);
  }

  const meta: PipelineMeta = {
    category,
    retried,
    forced,
    durationMs: Date.now() - start,
    issueKeys: issues,
  };
  console.log(JSON.stringify({ event: 'generate-palette', ...meta }));

  return { palette: toClientPalette(palette), meta };
}
