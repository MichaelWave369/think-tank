# ThinkTank dependency lock for PhiOS application qualification

## Purpose

ThinkTank's normal development workflow originally used floating semver ranges
and `npm install` without a committed `package-lock.json`. This meant
the PhiOS ThinkTank v0.60 hosted React/browser pilot could build a valid
snapshot, but could not promise to repeat the same complete dependency graph
on later machines.

The reviewed candidate for PhiOS is not automatically promoted by this change.

## Authoring and integrity

- A temporary, branch-scoped GitHub Actions bootstrap generated
  `package-lock.json` from the current ThinkTank `package.json`, using
  Node 24 and npm on a hosted Ubuntu runner.
- The authoring job executed `npm ci`, `npm test`, `npm run build` and
  `npm audit --audit-level=high` before committing the file.
- The bootstrap workflow **removed itself from the branch** before its
  commit, so it is not installed on `main`.
- The ordinary repository CI now uses `npm ci` instead of `npm install`.
- The committed lockfile pins package versions and integrity checksums; it
  does **not** imply all tarballs are available offline, nor does it authorize
  running installation scripts in a production PhiOS environment.

## PhiOS next gate

After review and merge, PhiOS must update its `thinktank-web` candidate
source SHA to this exact new upstream commit. It must then perform independent
transitive license and asset redistribution review and use the existing PhiOS
App Platform acquisition / build / install / launch mechanisms.

The present status remains:

- Real hosted React build and browser rendering: previously verified
  on the older source SHA by PhiOS v0.60.
- Committed npm lock: subject to this PR's successful CI and merge.
- Reproducible full offline dependency closure: **UNVERIFIED**.
- Installed and launched within PhiOS guest: **NOT RUN**.
- Provider bridge permission: **NOT GRANTED**.
- QEMU boot, install, update and rollback: **NOT RUN**.

**Ledger Above Ego. DONE Means Verified.**
