# PhiServe as Think Tank's local provider (opt-in)

Think Tank's governed `local` seat can use the **existing PhiServe daemon** instead of Ollama. It keeps Think Tank's role routing, evidence, and Reality Gate intact. PhiServe supplies **text inference only**; it is not a source of model opinions, permissions, memory, or governance.

## Setup (same computer)

1. In [PhiServe](https://github.com/MichaelWave369/PhiServe), register an existing licensed GGUF and set up a trusted local `llama-server` backend.
2. Generate a private bearer-token file: `phiserve auth create --output "$HOME/.phiserve/bridge-token.txt"`.
3. Start the PhiServe daemon with `--browser-origin` and `--api-key-file` paired, for example:
   `phiserve daemon --llama-server /trusted/path/llama-server --browser-origin https://michaelwave369.github.io --api-key-file "$HOME/.phiserve/bridge-token.txt"`.
   This binds to `127.0.0.1:11435`. Server-to-server requests from Think Tank include the bearer token and no Origin.
4. In Think Tank's **local** `.env` file (not committed), set:
   ```ini
   LOCAL_MODEL_BACKEND=phiserve
   PHISERVE_BASE_URL=http://127.0.0.1:11435
   PHISERVE_TOKEN_FILE=/absolute/private/path/bridge-token.txt
   PHISERVE_MODEL=your-registered-gguf-alias
   ```
   Windows paths work in local environment variables as normal.
5. Run `npm run bridge`, then open Think Tank and refresh local provider status. The `local` seat now reports provider `PhiServe` with actual GGUF aliases. Role/model assignment and LIVE execution remain explicitly operator-controlled.

**Existing Ollama users:** leaving `LOCAL_MODEL_BACKEND=ollama` preserves the old path unchanged. There is **no automatic failover** to cloud or to Ollama when PhiServe is selected. If PhiServe is stopped, its key file cannot be read, or a model is busy, the local seat reports failure and the governed run fails closed.

PhiServe's Ollama compatibility is intentionally restricted to text roles, `stream:false`, and `options.num_predict`. Think Tank's existing Ollama transport includes `think:false` with a legacy fallback; the PhiServe transport **never sends** that unsupported option. Only the final nonempty assistant text (from a completed response) is eligible for Think Tank role speech. No internal reasoning, tools, or private text get promoted.

## Boundaries

- PhiServe's auth file stays in the **local Node bridge**, not the browser or GitHub Pages.
- No wildcard CORS, new network listener, remote-host endpoint, secret logs or model-weight downloads.
- Do **not** enable PhiStream safetensors research checkpoints as live chat aliases; PhiServe's normal model catalog is GGUF-only.
- PhiServe can be shared with PocketBrain's browser adapter and others, but its current daemon has only **one resident llama.cpp model**. Switching models while active requests hold leases may yield HTTP 409; during model startup it may return HTTP 503. Think Tank retains failure receipts instead of silently retrying elsewhere.
- This is an adapter contract with unit/fake-HTTP tests, **not a physical model inference acceptance**. Test the actual local backend on your hardware before describing an app as live-wired.
