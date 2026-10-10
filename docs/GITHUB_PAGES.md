# Φ ThinkTank Live React GitHub Pages

## Public URL

**Target:** https://michaelwave369.github.io/think-tank/

The React app is deployed as a static GitHub Pages site, with Vite configured to use the repository-scoped `/think-tank/` base path. The original local development app remains rooted at `http://127.0.0.1:5173/`, which is also required for the existing Vessie ↔ ThinkTank two-app Chromium test.

## What is available publicly?

The real ThinkTank multi-mind React control room, mode selector, deterministic governed **RUN SIMULATION**, event-ledger replay, claim/evidence inspection, Reality Gate state, and Decision Dossier export all run locally inside the browser. Static Pages hosts files only. It does **not** host the local provider bridge, model weights, an API server, API keys, or independently authenticated runtime evidence.

The public build displays a prominent **PUBLIC REACT CONTROL ROOM · STATIC GITHUB PAGES** banner and links to source and Vessie. Unlike local developer builds, its initial render **does not auto-poll** `http://127.0.0.1:3691` for provider, research, signing or publisher status. That protects visitors from implicit network access to services running on their machines.

The existing **explicit** provider refresh and RUN LIVE PROVIDERS controls are not converted into a public AI API. They continue to require a separately installed trusted local bridge and manual interaction, and a hosted origin must be allowed in the local bridge's CORS configuration. Depending on browser security restrictions, public HTTPS → local HTTP requests may fail. No public GitHub Pages deployment is proof of a connected Ollama instance. **Never place API keys or passwords in frontend variables or workflow files.**

## Deploy

The workflow `.github/workflows/thinktank-pages.yml` is triggered by a push to `main` and has a `workflow_dispatch` fallback. It checks out the commit, installs Node 24 dependencies, runs ThinkTank unit tests, builds the production Pages React app with `VITE_PUBLIC_PAGES=true`, and validates the actual JS/CSS base path before uploading `dist` with official GitHub Pages Actions. `actions/configure-pages` attempts to enable Pages.

The first deployment may require a one-time GitHub repository setting:

1. Open **Settings → Pages** in `MichaelWave369/think-tank`.
2. Set **Build and deployment → Source: GitHub Actions** if it isn't already enabled. Check that Actions are allowed to deploy to the `github-pages` environment.
3. On merging this PR, watch **Actions → thinktank-pages**. If needed, use **Run workflow** to attempt an initial deploy.
4. After Pages succeeds, inspect **Actions → thinktank-pages-deployed-smoke** for postdeployment Chromium confirmation of the exact revision and published assets.

A successful premerge React build is **not** proof the public URL is serving it. If deployment is blocked by repository/organization Pages permissions, the code is ready but the URL remains unavailable until the owner changes those settings.

## Verification levels

- `npm run build`: standard local development/production build at `/`.
- `npm run pages:build`: builds static public profile at `/think-tank/`.
- `npm run pages:check`: checks real emitted JS/CSS asset files, URL base, presence of public static disclosure, and absence of root-absolute source entry references.
- **thinktank-pages**: uploads build artifact and asks GitHub Pages to deploy it. It writes `deploy-provenance.json` including source commit and deploying workflow run ID. That JSON is **self-reported** by the deploy job; flags deliberately say `browserVerified:false`, `independentProviderVerified:false`, `independentExternalDone:false`, and `cryptographicallySigned:false`. Publishing a manifest cannot establish it was independently verified.
- **thinktank-pages-deployed-smoke**: after a successful Pages **push** deployment on `main`, downloads the deployed public manifest, verifies exact commit and parent run ID, then starts real Chromium against the actual public site. It checks the application header, safety banner, visible operator and ledger, compiled JS/CSS subpath URLs, no failed assets, no runtime page exceptions, and **zero implicit local-bridge requests or write HTTP requests**. The workflow marks no public attestations or external DONE.
- Local ThinkTank #35 council live Ollama execution is **still a separately approved terminal command**. Nothing about Pages triggers it.

Use Vessie's existing safe path: manually launch a reviewed draft from **Vessie Company Mode → ThinkTank Local Draft Launch** to the *local* ThinkTank UI at `127.0.0.1:5173`, explicitly run a governed session, then export a dossier and inspect it in Vessie's Decision Bridge. A public ThinkTank URL is not currently an automated replacement for the local controller and is not an authorized remote council-session endpoint.

**Ledger Above Ego. DONE Means Verified.**
