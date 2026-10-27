// SwCafe AI Music Platform — serverless proxy for Replicate MusicGen.
//
// Why a function instead of calling Replicate from the browser?
// The REPLICATE_API_TOKEN is a billing credential. It must never ship to the
// client. This function keeps it server-side (Netlify env var) and exposes
// two small actions to the frontend:
//
//   POST /.netlify/functions/generate-music
//     { "action": "create", "prompt": "...", "duration": 30 }
//       -> 201 { "id": "<prediction-id>", "status": "starting" }
//
//     { "action": "status", "id": "<prediction-id>" }
//       -> 200 { "status": "processing" | "succeeded" | "failed" | "canceled",
//                "output": "<mp3-url>" (when succeeded),
//                "error": "<message>" (when failed) }
//
//     { "action": "cancel", "id": "<prediction-id>" }
//       -> 200 { "status": "canceled" } (best-effort; safe to call even if
//                the prediction already finished)
//
// The frontend polls `status` every few seconds. This function never polls
// itself — each call is a single fast Replicate request, well under the
// serverless time limit.
//
// Generation notes:
// - `normalization: true` turns on MusicGen's loudness normalization.
// - `duration` is clamped to 5–120s (the model's documented range);
//   Replicate errors surface verbatim if a duration is rejected.

const REPLICATE_API = 'https://api.replicate.com/v1/predictions';
// Pinned meta/musicgen model version (verified working 2026-10-08).
const MUSICGEN_VERSION = '671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

const parseBody = (event) => {
  if (!event.body) return null;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const replicateFetch = async (path, token, options = {}) => {
  const res = await fetch(`${REPLICATE_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
};

// NOTE: this repo's package.json sets "type": "module", so this file is ESM.
// Netlify loads it accordingly — the handler must be an ES export.
export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.' });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return json(500, { error: 'Server missing REPLICATE_API_TOKEN' });
  }

  const body = parseBody(event);
  if (!body || typeof body.action !== 'string') {
    return json(400, { error: 'Bad request: expected JSON { action: "create" | "status", ... }' });
  }

  try {
    // ---------------------------------------------------------------
    // action: "create" — start a new MusicGen prediction
    // ---------------------------------------------------------------
    if (body.action === 'create') {
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      if (!prompt) {
        return json(400, { error: 'Bad request: "prompt" is required.' });
      }
      const duration = Math.min(Math.max(Number(body.duration) || 30, 5), 120);

      const { res, data } = await replicateFetch('', token, {
        method: 'POST',
        body: JSON.stringify({
          version: MUSICGEN_VERSION,
          input: {
            prompt: prompt.slice(0, 1000),
            duration,
            output_format: 'mp3',
            model_version: 'stereo-melody-large',
            normalization: true,
          },
        }),
      });

      if (res.status !== 201) {
        return json(res.status, {
          error: data?.detail || data?.error || `Replicate rejected the request (${res.status}).`,
        });
      }
      return json(201, { id: data.id, status: data.status });
    }

    // ---------------------------------------------------------------
    // action: "status" — check a prediction, return audio URL when done
    // ---------------------------------------------------------------
    if (body.action === 'status') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        return json(400, { error: 'Bad request: "id" is required.' });
      }

      const { res, data } = await replicateFetch(`/${encodeURIComponent(id)}`, token);

      if (res.status !== 200) {
        return json(res.status, {
          error: data?.detail || data?.error || `Replicate lookup failed (${res.status}).`,
        });
      }

      const status = data.status;
      if (status === 'succeeded') {
        const output = Array.isArray(data.output) ? data.output[0] : data.output;
        return json(200, { status, output: output || null });
      }
      if (status === 'failed' || status === 'canceled') {
        return json(200, {
          status,
          error: data?.error || 'The AI engine could not finish this track.',
        });
      }
      // "starting" | "processing" — still working
      return json(200, { status });
    }

    // ---------------------------------------------------------------
    // action: "cancel" — stop a running prediction (best-effort)
    // ---------------------------------------------------------------
    if (body.action === 'cancel') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        return json(400, { error: 'Bad request: "id" is required.' });
      }

      const { res, data } = await replicateFetch(`/${encodeURIComponent(id)}/cancel`, token, {
        method: 'POST',
      });

      if (res.status !== 200) {
        return json(res.status, {
          error: data?.detail || data?.error || `Replicate cancel failed (${res.status}).`,
        });
      }
      return json(200, { status: data.status || 'canceled' });
    }

    return json(400, { error: 'Bad request: unknown action. Use "create" or "status".' });
  } catch (err) {
    console.error('generate-music error:', err);
    return json(502, { error: 'Could not reach the AI engine. Please try again.' });
  }
};
