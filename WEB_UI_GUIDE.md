# Web UI: Next.js + Tailwind + Plotly

A concise, copy-pasteable guide to set up, build, troubleshoot, and run the web app as a service. This assumes the app lives in `apps/web-next/`.

---

## 1) Prerequisites
Before you start, make sure you have the following installed and configured:

### Install Node.js
- Install **Node.js v20.x** (LTS) using [nvm](https://github.com/nvm-sh/nvm):
```bash
nvm install 20
nvm use 20
```
- Create an `.nvmrc` file in your repo root with the version number:
```bash
echo "20" > .nvmrc
```
- Verify version:
```bash
node -v
```

### Install Next.js
- In `apps/web-next/`:
```bash
npm init -y
npm install next react react-dom
```

### Install Tailwind CSS
- From `apps/web-next/`:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
- Configure `tailwind.config.js` content paths:
```js
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: { extend: {} },
  plugins: [],
}
```
- Add Tailwind directives to `styles/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Repo Recommendations
- `.nvmrc` with `20`
- `apps/web-next/next.config.mjs`
- `apps/web-next/tsconfig.json`
- `apps/web-next/types/` for local type shims if needed

---

## 2) Install & run (dev)
```bash
cd apps/web-next
npm install
npm run dev
# open http://localhost:3000
```
Routes:
- `/pie` — Animated donut (CSV: `year,category,amount`)
- `/bar` — Animated bar race (CSV: `time,category,value`)
- `/map` — Animated US choropleth (CSV: `year,abbr,value` or `year,state,abbr,median_income`)

**Tip:** After replacing source files, clear the build cache:
```bash
rm -rf .next
npm run dev
```

---

## 3) Build & run (production)
```bash
cd apps/web-next
npm run build
npm run start     # default port 3000
```

**One-liner**
```bash
cd apps/web-next && npm run build && npm run start
```

---

## 4) CSV schemas (upload in the UI)
- **/pie**: `year,category,amount`
- **/bar**: `time,category,value` (needs multiple distinct `time` values to animate)
- **/map**: accepts either schema, ignores extra columns:
  - `year,abbr,value`
  - `year,state,abbr,median_income`

---

## 5) Common errors & quick fixes

**A. `ReferenceError: frames is not defined`**
- Cause: `frames` passed without being defined.
- Fix: Remove `frames={frames}` unless you explicitly build frames for animations.

**B. CSV parsing issues**
- Cause: Column names mismatch.
- Fix: Ensure uploaded CSV matches the schema in section 4.

**C. TypeScript errors for missing module declarations**
- Install type packages:
```bash
npm i --save-dev @types/papaparse @types/react-plotly.js
```
- Or add a `types/modules.d.ts`:
```ts
declare module 'papaparse';
declare module 'react-plotly.js';
```

**D. Port already in use**
```bash
lsof -i :3000
kill -9 <PID>
```

**E. Build cache issues**
```bash
rm -rf .next
npm run build
```

**F. Tailwind styles not loading**
- Ensure `content` paths in `tailwind.config.js` include `./app/**/*.{js,ts,jsx,tsx}`.

**G. `npm run build` fails with missing types**
- Follow C above to add missing type declarations.

**H. Blank charts**
- Cause: Data mismatch or empty dataset.
- Fix: Check browser console for CSV parse output.

---

## 6) Running as a service (no terminal)

### Option 1 — PM2 (macOS/Linux; Windows user‑level)
```bash
cd apps/web-next
npm ci
npm run build
which node  # copy absolute path
```
Create `ecosystem.config.js`:
```js
module.exports = {
  apps: [
    {
      name: "web-next",
      cwd: __dirname,
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 3000",
      interpreter: "/ABSOLUTE/PATH/TO/NODE", // from `which node`
      env: { NODE_ENV: "production", PORT: "3000" },
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      out_file: "./logs/out.log",
      error_file: "./logs/err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
}
```
Start & persist:
```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 status
pm2 startup        # run the printed command once (macOS uses launchd)
pm2 save
```
Redeploy:
```bash
cd apps/web-next && npm ci && npm run build && pm2 restart web-next && pm2 save
```

### Option 2 — Linux systemd (server‑grade)
Create `/etc/systemd/system/median-viz.service`:
```ini
[Unit]
Description=Median Viz Next.js service
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/repo/apps/web-next
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
User=www-data
Group=www-data
StandardOutput=append:/path/to/repo/apps/web-next/logs/out.log
StandardError=append:/path/to/repo/apps/web-next/logs/err.log

[Install]
WantedBy=multi-user.target
```
```bash
sudo mkdir -p /path/to/repo/apps/web-next/logs
sudo systemctl daemon-reload
sudo systemctl enable median-viz
sudo systemctl start median-viz
sudo systemctl status median-viz
```

### Option 3 — Windows service (NSSM)
- Install **NSSM** (nssm.cc) and add to PATH.
- Create `start-web-next.bat`:
```bat
@echo off
cd /d C:\median_viz\apps\web-next
set NODE_ENV=production
set PORT=3000
call npm run start
```
- `nssm install MedianViz` → set Application to `cmd.exe`, Arguments to `/c C:\median_viz\apps\web-next\start-web-next.bat`.
- Start: `nssm start MedianViz`.

---

## 7) CI (optional but recommended)
Add `.github/workflows/web-next-ci.yml`:
```yaml
name: web-next CI
on:
  pull_request:
    paths: ["apps/web-next/**"]
  push:
    branches: [ main ]
    paths: ["apps/web-next/**"]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: apps/web-next/package-lock.json
      - name: Install
        working-directory: apps/web-next
        run: npm ci
      - name: Build
        working-directory: apps/web-next
        run: npm run build
```

---

## 8) FAQ
**Q: My `/map` upload doesn’t animate.**  
A: Ensure multiple distinct `year` values exist; the slider only appears with >1 frame.

**Q: The bar race overflows labels.**  
A: Reduce font or set `textposition: 'none'` and rely on axes; widen left margin.

**Q: Can I change to a dark theme?**  
A: Set `template: 'plotly_dark'`, adjust `paper_bgcolor/plot_bgcolor`, and swap pastel colors.

**Q: How do I enforce Node 20 for everyone?**  
A: Commit `.nvmrc` and add `"engines": { "node": ">=20 <21" }` to `package.json`.

**Q: What should never be committed?**  
A: `node_modules/`, `.next/`, `dist/`, `.env*`. Keep `package-lock.json` tracked.

**Q: Can I run this without TypeScript?**  
Yes — remove `tsconfig.json` and use `.js` files.

**Q: How do I change the default port?**  
Set `PORT` before running `npm run start`:
```bash
PORT=4000 npm run start
```

**Q: How to add another chart type?**  
- Create a new route under `app/`
- Add a CSVUpload component
- Add a ClientPlot instance with the right Plotly layout

**Q: Can I deploy to Vercel?**  
Yes, this is a standard Next.js app — just link the repo in Vercel.

