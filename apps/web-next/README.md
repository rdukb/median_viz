# Median Viz web app

This package contains the Next.js 14 application for the Median Viz collaborative analytics Studio.

- Live Studio: [https://median-viz.vercel.app/studio](https://median-viz.vercel.app/studio)
- Demo video: [https://youtu.be/bZnqu3Oarfs](https://youtu.be/bZnqu3Oarfs)
- Runtime: Node.js 22.x
- WebMCP surface: exactly three read tools and four guarded mutation tools

> **Demo dataset — representative LinkedIn B2B audience performance data**

## Run

```bash
npm ci
npm run dev
```

Open `http://localhost:3000/studio`.

## Verify

```bash
npm test
npm run eval:webmcp
npm run build
```

The build includes source and generated-output privacy scans. The public demo uses only fictional Northstar Media identities.

## Routes

- `/studio` — primary human/agent workspace
- `/pie`, `/bar`, `/map` — legacy chart-gallery examples

## Documentation

- [Repository overview](../../README.md)
- [Studio interaction and data contract](STUDIO_PROTOTYPE.md)
- [Deployment preflight](DEPLOYMENT_PREFLIGHT.md)
- [WebMCP evaluation guide](evals/README.md)
