# Median Viz web application guide

The Next.js application under `apps/web-next` hosts the primary `/studio` collaborative analytics workspace and the legacy `/pie`, `/bar`, and `/map` chart-gallery routes.

> **Demo dataset — representative LinkedIn B2B audience performance data**

Live application: [https://median-viz.vercel.app/studio](https://median-viz.vercel.app/studio)

## Requirements

- Node.js 22.x, pinned by `.nvmrc` and `apps/web-next/package.json`
- npm with the committed `package-lock.json`
- A browser with WebMCP support to discover the seven page tools; other browsers still support the human Studio controls

## Install and run

From the repository root:

```bash
nvm use
cd apps/web-next
npm ci
npm run dev
```

Open `http://localhost:3000/studio`.

## Routes

| Route | Purpose |
|---|---|
| `/studio` | Primary shared human/agent LinkedIn B2B audience workspace. |
| `/pie` | Legacy animated revenue-donut example with CSV upload. |
| `/bar` | Legacy animated bar-race example with CSV upload. |
| `/map` | Legacy animated US choropleth example with CSV upload. |

Legacy CSV shapes:

- `/pie`: `year,category,amount`
- `/bar`: `time,category,value`
- `/map`: `year,state,abbr,median_income`

Studio uses a canonical representative fixture and does not consume those gallery upload schemas.

## WebMCP behavior

When `document.modelContext` is available, Studio registers three read tools and four guarded mutation tools. Human controls and WebMCP mutations call the same workspace capability layer; Plotly is only a rendering adapter.

Use the [Studio interaction contract](apps/web-next/STUDIO_PROTOTYPE.md) for schemas and semantics, and the [evaluation guide](apps/web-next/evals/README.md) for the demo flow.

## Verification

Run from `apps/web-next`:

```bash
npm test
npm run eval:webmcp
npm run build
```

`npm test` runs the source privacy scan before the test suite. `npm run build` scans source before compilation and generated `.next` output afterward.

## Production-style local run

```bash
npm run build
npm run start
```

The default port is 3000. Set `PORT` before `npm run start` to override it.

## Troubleshooting

### Wrong Node version

Run `nvm use` at the repository root and confirm `node -v` reports Node 22.x. The Vercel project uses the same major version.

### Missing dependencies

Use `npm ci` from `apps/web-next`. Do not regenerate `package-lock.json` for an ordinary install.

### Stale Next.js output

Stop any running development server, remove `.next`, and rerun the relevant command. Do not commit `.next` or `.test-dist`.

### WebMCP tools are unavailable

The Studio remains usable through human controls in unsupported browsers. For agent testing, use ChatGPT's in-app browser or a compatible browser with WebMCP enabled, then open `/studio` in a fresh tab.

### Duplicate tools during development

Registration is tied to an `AbortController` lifecycle so React Strict Mode replacement remains safe. A clean reload should still expose exactly seven tools.

## Deployment

The existing Vercel project uses:

- repository: `rdukb/median_viz`;
- root directory: `apps/web-next`;
- runtime: Node.js 22.x;
- build command: `npm test && npm run eval:webmcp && npm run build`.

Do not create a duplicate project. Keep private privacy-validation values in the deployment secret store and out of Git, logs, generated output, and documentation. See [DEPLOYMENT_PREFLIGHT.md](apps/web-next/DEPLOYMENT_PREFLIGHT.md) for the guarded deployment and rollback procedure.

## Related documentation

- [Repository README](README.md)
- [Studio interaction and data contract](apps/web-next/STUDIO_PROTOTYPE.md)
- [Deployment preflight](apps/web-next/DEPLOYMENT_PREFLIGHT.md)
- [WebMCP evaluations](apps/web-next/evals/README.md)
