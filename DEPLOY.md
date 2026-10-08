# Deploying SwCafe — AI Music Platform (with real AI song generation)

The app's AI song generation runs through a Netlify serverless function
(`netlify/functions/generate-music.js`) that talks to Replicate's MusicGen
model. Your Replicate API token lives **only** as a Netlify environment
variable — it is never in the code.

## 1. Push this repo to GitHub

```bash
git push origin HEAD:main
```

## 2. Create the Netlify site

1. Go to Netlify → **Add new site → Import an existing project**.
2. Connect GitHub and select the `swcafe-ai-music-platform` repo.
3. Build settings (Netlify usually picks these up from `netlify.toml` automatically):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
4. Deploy the site.

## 3. Add your Replicate token

1. In Netlify: **Site settings → Environment variables → Add a variable**.
2. Key: `REPLICATE_API_TOKEN`
   Value: your Replicate API token (from replicate.com → Account → API tokens).
3. **Redeploy** the site after adding the variable (Deploys → Trigger deploy),
   so the function picks it up.

That's it. Open the Song Creator, describe a song, hit **Create ♪** — the
track composes on Replicate (~1–2 min) and auto-plays in the player when done.

## Local testing (optional)

```bash
npm install -g netlify-cli
netlify dev
```

`netlify dev` serves the app **and** the function at
`http://localhost:8888`, so `/.netlify/functions/generate-music` resolves
locally. Set `REPLICATE_API_TOKEN` in a local `.env` file (already gitignored)
before running.

> Note: running the app with plain `vite dev` / `vite preview` (no Netlify)
> means the function endpoint 404s. The Song Creator detects this and shows
> "AI engine not connected — deploy to Netlify first (see DEPLOY.md)"
> instead of crashing. Everything else in the app still works.
