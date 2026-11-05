# Netlify deploy

This repository publishes the static artifact from `docs/` and runs one serverless function from `netlify/functions/`.

## Deploy

Import the repository into Netlify. `netlify.toml` sets:

- publish directory: `docs`
- build command: none
- functions directory: `netlify/functions`

## Live explanation function

Netlify serves `netlify/functions/explain.mjs` at:

`/.netlify/functions/explain`

Set the Groq key as a Netlify environment variable:

1. Open Site settings.
2. Go to Environment variables.
3. Add `GROQ_API_KEY` with the key value.
4. Redeploy the site.

The key is read server-side. It is not included in `docs/index.html` or any browser request.

## Static fallback

GitHub Pages cannot run the function. On GitHub Pages the artifact uses the scripted explanation fallback and labels it clearly.

## Data note

The data is synthetic Monte Carlo data for presentation and software testing only. It is not real MSE data and is not the study's final evidence.
