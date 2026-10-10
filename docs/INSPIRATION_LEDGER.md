# TT-37: Inspiration Ledger

Original ThinkTank browser-local scratchpad for independent invention, not a code harvester.

INSPIRE → ABSTRACT → INVENT → PROTOTYPE → VERIFY.

## Strict boundaries

- Everything is manually written by the operator. The HTTPS URL is a lead,
  not source verification, a license review, evidence or permission.
- No third-party source code, assets, libraries or integrations are reused.
- No external repository fetch/clone, automatic API calls or agent execution.
- Drafts cannot change canonical ThinkTank events, evidence, Reality Gate,
  dossiers, release gates or Anti-M completion state.
- The operator can export JSON, but localStorage and exported files are
  mutable, unsigned, not cryptographically sealed and can be lost.
- All entries are explicitly operator-unverified with false sourceVerified,
  codeImported and executionAuthority flags.

## Verification for merge

Run npm test, npm run build, npm run pages:build and npm run pages:check.
Check public Pages post-deployment smoke separately. These checks have not been
claimed green by this document.

## Later possibilities (not part of TT-37)

Human-reviewed concept comparison and separate provenance-bound export may be
considered later, but must not inherit source authority or trigger agents.
