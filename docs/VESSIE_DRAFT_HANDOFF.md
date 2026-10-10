# TT-34: Safe Vessie Draft Handoff

This introduces a **client-only, review-only URL-fragment intake** for an operator-composed directive created in Super Φ.Vessel. It does **not** add a remote provider execution API, change LIVE scheduling, or silently create canonical ThinkTank events.

## Path
1. The human writes a fresh directive in Vessie's local ThinkTank Launch Desk and explicitly clicks **OPEN DRAFT IN LOCAL THINKTANK**.
2. Vessie opens the local ThinkTank UI at http://127.0.0.1:5173 with a bounded, UTF-8 Base64URL fragment named `#spv-draft=`. Fragment values are **plain encoding, not encryption**. Do not put passwords, API keys or sensitive customer data inside. Fragment bytes are not part of HTTP requests to the ThinkTank server, but the URL can remain in browser history or be observed by client scripts, extensions and anyone with session access.
3. ThinkTank deletes the fragment from the address bar at first render via `history.replaceState`, validates the exact schema and required zero-authority flags, and displays the submitted text in an **untrusted incoming draft preview**.
4. The operator must click **USE REVIEWED DRAFT IN OPERATOR INPUT (NO RUN)**. This copies just the directive into ThinkTank's normal editable operator prompt field. It does not change mode, model assignment, routing, evidence or ledger state.
5. For a real governed session the operator manually sets mode, refreshes provider status and assignments, checks model costs, and explicitly presses **RUN LIVE PROVIDERS** inside ThinkTank. ThinkTank's existing gate, provider failure, Challenger, ledger and dossier contracts remain authoritative.
6. The operator can optionally export the resulting ThinkTank dossier and manually import it into Vessie's #77 one-way decision bridge. No automatic return data is transferred.

## Boundaries
- User-installed local ThinkTank Vite dev server is assumed at `http://127.0.0.1:5173`. Run it using `npm run dev -- --host 127.0.0.1 --port 5173`. The separate existing provider bridge stays at `127.0.0.1:3691`.
- The draft is not a live request, a provider command, permission, verified fact, trusted source, ticket, or an authenticated identity. Text is human supplied and potentially attacker edited.
- Incoming handoff has **no automatic calls** to the keyholding provider bridge. It never executes a model, sends prompts to an API, runs an action, or spends tokens.
- The current provider bridge has `GET /health`, `GET /providers/status`, and `POST /providers/invoke`. It does **not** have a governed council-session API that Vessie could safely call. This rung specifically avoids masquerading a single provider invocation as a complete council.
- Local installation may use another port; the protocol is fragment-based but the Vessie side is intentionally pinned to a single local URL. The operator can still paste a directive manually using normal clipboard workflows.
- The `#spv-draft=` fragment is capped; unsupported encodings, forged action flags, invalid schemas and out-of-limit directives are refused. The fragment is removed from the address bar before parsing.
- A real prefilled input remains user-controlled and is never sufficient to start ThinkTank LIVE. Claim governance and Reality Gate remain unchanged.

## Tests
`npm test && npm run bridge:check && npm run build`. Unit tests check UTF-8, schema, authority flags, size and control characters. No network calls or model invocations are involved.

**Ledger Above Ego. DONE Means Verified.**
