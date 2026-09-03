# Public-demo deployment preflight and rollback contract

## BLUF

The public challenge application is live and browser-verified at [https://median-viz.vercel.app/studio](https://median-viz.vercel.app/studio). This document preserves the fail-closed checks and approval boundaries used to build, verify, promote, and roll back the deployed Studio.

Current production record:

- Vercel project: `rdukbs-projects/median-vizr`;
- root directory: `apps/web-next`;
- live route: `https://median-viz.vercel.app/studio`;
- deployed application source: `ef80a92fe702af8fcfc2fad26efb5d4d34e719d4`;
- production deployment: `median-vizr-mu0scsgt2-rdukbs-projects.vercel.app`;
- immediate rollback deployment: `median-vizr-1ovtjj6wu-rdukbs-projects.vercel.app`.

## Dataset provenance

The current public dataset is representative, synthetic demo data:

> **Demo dataset — representative LinkedIn B2B audience performance data**

It is not live production data, an export of staging delivery, or real customer performance. When the already-anonymized fixture arrives, update the canonical provenance and disclosure together to:

> **Anonymized historical sample — privacy-adjusted directional data**

## Local preflight commands

```bash
npm test
npm run eval:webmcp
npm run build
npm run preflight:deployment:report
```

The strict deployment gate is:

```bash
npm run preflight:deployment
```

It exits non-zero when a static check fails or an external deployment prerequisite is blocked. It checks only for environment-variable presence and never prints secret values or Vercel project identifiers.

## Frozen Vercel configuration

The existing Vercel project uses:

- Git repository: `rdukb/median_viz`;
- Root Directory: `apps/web-next`;
- Framework: Next.js;
- Node.js: `22.x`;
- Install: lockfile-detected npm install;
- Build Command: `npm test && npm run eval:webmcp && npm run build`;
- Output: Next.js-managed `.next` output;
- preview before production promotion.

The root directory is a Vercel project setting for monorepos. `vercel.json` freezes the app-local framework and guarded build command. Source and deployment-log visibility remain Vercel project settings and are not represented by an app-local `vercel.json` property. See Vercel's [monorepo root-directory guidance](https://vercel.com/docs/builds/configure-a-build) and [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Privacy gate

Preview and production builds must provide one private, deployment-environment value:

```text
DEMO_PRIVATE_DENYLIST_BASE64
```

The decoded content is a newline-delimited private term list. It must remain in a Vercel Sensitive Environment Variable or equivalent secret store, never in Git, fixture metadata, build logs, or generated artifacts.

`npm run build` scans source and generated `.next` output. The hosted smoke script scans returned HTML using the same private terms without printing them.

Required invariant:

- canonical Northstar identities only;
- representative-demo disclosure present;
- no historical customer identity;
- no source Campaign URN or raw fixture row;
- no browser-persisted workspace state;
- exactly seven WebMCP tools.

## Hosted verification gate

Before any production promotion, create a separately approved preview and run:

```bash
DEMO_PRIVATE_DENYLIST_BASE64=... \
  npm run smoke:deployment -- https://<preview-url>
```

Then open the same preview in ChatGPT's built-in browser and verify:

1. exactly seven tools are discoverable;
2. three tools have `readOnlyHint: true` and four have `readOnlyHint: false`;
3. “What can I break this audience down by?” returns nine pivots;
4. CPC by Industry across Product Ad Sets updates visible controls once;
5. an identical request returns `noOp: true` without a revision;
6. CPA is supported but unavailable, with null rather than zero/Infinity;
7. cross-pivot input fails without mutation;
8. reset preserves `dataset_demo_001`;
9. `/studio`, `/pie`, `/bar`, and `/map` return 200;
10. `/studio` returns `Origin-Agent-Cluster: ?1` and the browser console is clean.

Do not promote a preview until this evidence is recorded and separately approved. The current production candidate passed this checklist before promotion.

## Source binding

The deployment packet must record:

- clean Git status for `apps/web-next`;
- exact 40-character commit SHA;
- build output from that SHA;
- preview deployment URL and immutable deployment ID;
- Vercel project/team target;
- privacy-secret presence by name only;
- smoke-test result.

The source-binding check is conservative for every tracked and untracked file under `apps/web-next`. Any uncommitted app file blocks the gate; exclusions must be resolved outside the deployable tree rather than allowlisted in the preflight.

## Rollback contract

Before production promotion, record the last-known-good production deployment URL in the operator packet as `VERCEL_ROLLBACK_DEPLOYMENT_URL`. The current immediate rollback target is listed in the production record above.

If production validation fails:

```bash
vercel rollback <last-known-good-deployment-url>
vercel rollback status
```

Verify `/studio`, compatibility routes, privacy disclosure, and WebMCP discovery after rollback. Vercel documents that rollback operates at the routing layer; `vercel promote <deployment-url>` can later undo the rollback after a reviewed fix. See [Vercel rollback](https://vercel.com/docs/cli/rollback) and [production rollback guidance](https://vercel.com/docs/deployments/rollback-production-deployment).

## Approval boundary

Each action below requires a separate approval; this preflight does not authorize:

- `vercel link` or project creation;
- Vercel environment-variable writes;
- Git commit or push;
- preview deployment;
- production promotion;
- domain changes;
- rollback execution;
- Cloud SQL, backend, or staging export work.
