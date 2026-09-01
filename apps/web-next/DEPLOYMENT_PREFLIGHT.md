# Slice 6 public-demo deployment preflight

## BLUF

The application is locally buildable and browser-verified, but it is **not ready for production deployment approval yet**. No deployment was created by this slice.

Current blocking gates:

- no Vercel project binding is present;
- the private privacy-denylist secret is not available in the deployment environment;
- the deployable application changes are not committed to an immutable Git revision;
- no last-known-good production deployment URL is recorded for rollback;
- hosted HTTPS and ChatGPT WebMCP discovery remain unverified until a separately approved preview exists.

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

The proposed Vercel project must use:

- Git repository: `rdukb/median_viz`;
- Root Directory: `apps/web-next`;
- Framework: Next.js;
- Node.js: `22.x`;
- Install: lockfile-detected npm install;
- Build Command: `npm run build`;
- Output: Next.js-managed `.next` output;
- preview before production promotion.

The root directory is a Vercel project setting for monorepos; it has not been created or changed here. `vercel.json` freezes the app-local framework and guarded build command. Source and deployment-log visibility remain Vercel project settings and are not represented by an app-local `vercel.json` property. See Vercel's [monorepo root-directory guidance](https://vercel.com/docs/builds/configure-a-build) and [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Privacy gate

Preview and production builds must provide one private, deployment-environment value:

```text
PUBLIC_DEMO_PRIVATE_DENYLIST_BASE64
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

## Preview-only verification gate

After separate approval creates a preview, run:

```bash
PUBLIC_DEMO_PRIVATE_DENYLIST_BASE64=... \
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

Do not promote the preview until this evidence is recorded and separately approved.

## Source binding

The deployment packet must record:

- clean Git status for `apps/web-next`;
- exact 40-character commit SHA;
- build output from that SHA;
- preview deployment URL and immutable deployment ID;
- Vercel project/team target;
- privacy-secret presence by name only;
- smoke-test result.

The source-binding check remains conservative for tracked and untracked files under `apps/web-next`. The reviewed local process-manager file `apps/web-next/ecosystem.config.js` is the sole explicit exception because it is not a Git or Vercel deployment input; any other uncommitted app file blocks the gate.

## Rollback contract

Before production promotion, record the last-known-good production deployment URL in the operator packet as `VERCEL_ROLLBACK_DEPLOYMENT_URL`.

If production validation fails:

```bash
vercel rollback <last-known-good-deployment-url>
vercel rollback status
```

Verify `/studio`, compatibility routes, privacy disclosure, and WebMCP discovery after rollback. Vercel documents that rollback operates at the routing layer; `vercel promote <deployment-url>` can later undo the rollback after a reviewed fix. See [Vercel rollback](https://vercel.com/docs/cli/rollback) and [production rollback guidance](https://vercel.com/docs/deployments/rollback-production-deployment).

For the first production release, there may be no prior eligible deployment. Keep the candidate as a preview with no production domain assignment until all smoke and browser checks pass; promotion requires a separate approval.

## Approval boundary

This preflight does not authorize:

- `vercel link` or project creation;
- Vercel environment-variable writes;
- Git commit or push;
- preview deployment;
- production promotion;
- domain changes;
- rollback execution;
- Cloud SQL, backend, or staging export work.
