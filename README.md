# ChromaCraft

a color palette previewer for designers and developers who are tired of guessing how their colors will look in real interfaces

## why I built this

i spend a lot of time creating marketing posts, exploring branding colors for new project ideas, and building side projects. the problem was always the same: i would pick colors that looked good in isolation, but had no idea how they would work together in an actual ui until i built something with them

existing color tools would show me swatches or simple gradients, but nothing that felt like a real website or app. so i made chromacraft to solve that for myself

## what it does

- generates harmonious 5-color palettes using ai based on a text description
- shows your palette applied to real ui components in real-time: a hero section, a mobile app mockup, buttons, cards, and more
- exports your palette in multiple formats: css variables, tailwind config, and scss variables

## research-backed color optimization

chromacraft doesn't just generate pretty colors, it applies behavioral psychology and conversion science to create palettes that actually perform. the prompt is distilled from academic research and industry a/b testing data, and every generated palette is then checked with real color math before it reaches you

### key principles

**the 50ms rule**: users form permanent aesthetic judgments in 50 milliseconds (lindgaard 2006). chromacraft ensures every palette passes the "visceral gate" with proper contrast ratios and visual harmony before any conscious evaluation begins.

**the isolation effect**: call-to-action buttons convert better when they visually "pop." chromacraft steers accent colors toward the complement of the secondary (180° opposite on the color wheel) for maximum saliency. this technique has shown 21% conversion lifts in a/b tests

**the 60-30-10 rule**: borrowed from interior design, this distribution (60% background, 30% secondary, 10% accent) reduces cognitive load and creates clear visual hierarchy.

**category-specific optimization**: different industries have different color expectations. fintech needs blue/navy for trust. luxury brands need desaturated, muted tones. startups need energetic warm accents. chromacraft detects context from your description and applies the right rules automatically

**accessibility-first**: every palette is measured for wcag aa contrast (4.5:1 for text) using linearized-srgb relative luminance, and auto-corrected if it falls short. it also uses research-backed alternatives like charcoal over pure black to reduce eye strain

## how generation works

1. `components/AIInput.tsx` collects the description and calls `generatePalette` in `services/ai.ts`
2. `services/ai.ts` POSTs to `/api/generate-palette`
3. the serverless function (`api/generate-palette.ts`) is a thin handler over `api/_lib/`:
   - `rules.ts` detects the category from keywords
   - `prompt.ts` builds a schema-constrained prompt (the user text is wrapped as untrusted data)
   - `client.ts` calls the ai provider for a structured json palette
   - `validate.ts` + `color.ts` validate and correct the palette with real color math (contrast, hue separation, luminosity, category rules)
   - `pipeline.ts` orchestrates: generate, validate/correct, one retry with feedback, then a deterministic force-correction so a valid 5-hex palette is always returned
   - only the five hex fields are returned to the client, never the model's raw text

`api/_lib/` uses a leading underscore so Vercel does not treat those modules as routable endpoints; they are still typechecked by `npm run build`.

## setup

### prerequisites

- node.js
- an xai api key from [console.x.ai](https://console.x.ai) (the default provider is xai's `grok-4.20-0309-non-reasoning`, which is very cheap)

### running locally

1. clone the repo and install dependencies:
   ```
   npm install
   ```

2. create a `.env` file in the root directory:
   ```
   XAI_API_KEY=your_xai_api_key_here
   ```

3. start the dev server with vercel cli (this runs both the frontend and api routes):
   ```
   npm run dev:vercel
   ```

   if you don't have vercel cli installed, install it first:
   ```
   npm i -g vercel
   ```

   note: plain `npm run dev` runs vite only, so `/api/generate-palette` does not exist and generation will fail. use `npm run dev:vercel` for anything touching generation.

### switching providers

the endpoint uses the OpenAI-compatible SDK, so any OpenAI-compatible provider works with env vars only, no code changes:

- `AI_API_KEY` is used if `XAI_API_KEY` is not set
- `AI_BASE_URL` overrides the base url (default `https://api.x.ai/v1`)
- `AI_MODEL` overrides the model (default `grok-4.20-0309-non-reasoning`)

for example, Groq's free tier: `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=llama-3.3-70b-versatile`, `AI_API_KEY=...`. if a provider rejects strict json-schema output, the pipeline automatically falls back to json-object mode plus local validation.

### deploying to vercel

add `XAI_API_KEY` (or `AI_API_KEY`) as an environment variable in your project settings under settings > environment variables, enabled for production, preview, and development.

`vercel.json` sets `maxDuration: 60` for the function so the retry path is not killed mid-flight. if your plan caps functions at 10s, lower the per-request timeout in `api/_lib/client.ts` accordingly.

## tests

```
npm test    # vitest unit tests for the pure api/_lib modules
npm run build   # tsc typecheck + vite build
```

## security notes and residual risk

being honest about what is and isn't protected here:

- **the provider key is server-side only.** it lives in `api/` functions, read from `XAI_API_KEY`/`AI_API_KEY`, and is never sent to the browser. there is no `VITE_`-prefixed key anywhere; do not add one (vite would bake it into the public bundle).
- **the endpoint is unauthenticated.** there is no login. same-origin is not a real control: `curl`/bots can still call `/api/generate-palette` and spend credits. the mitigations are the 500-character input cap, the per-ip rate limit, the model `max_tokens` cap, and a request timeout.
- **the rate limit is best-effort.** it is an in-memory fixed window (10 requests / 10 minutes per ip) that lives per warm instance: it resets on cold start and does not coordinate across instances. good enough for a personal tool; the follow-up if abuse ever appears is Upstash / Vercel KV. **set a spend cap in the xai console as the real backstop.**
- **prompt injection is contained, not prevented.** the user description is wrapped in `<user_description>` tags and treated as untrusted data, but the actual protection is that output is schema-constrained, deterministically re-validated with color math, and the model's free text is never returned to the client.
- **old leaked keys are revoked and intentionally left in git history.** earlier commits baked a client-side gemini key into the bundle and briefly committed key files; those keys are dead. history was not rewritten. when deploying, remove any stale `GEMINI_API_KEY` / `OPENAI_API_KEY` / `API_KEY` variables from the Vercel project env so nothing unused lingers.

## tech stack

- react with typescript
- vite
- tailwind css (via cdn)
- xai `grok-4.20-0309-non-reasoning` (default) for palette generation, via the OpenAI-compatible SDK
