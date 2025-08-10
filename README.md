# Median Income & Revenue Visualizations

Interactive data visualizations with **two runtimes**:

- **Python CLI (Plotly Express)** — quick scripts to produce shareable HTML: choropleth map, bar, pie.
- **Next.js + Tailwind (Plotly.js)** — modern, pastel UI with animated charts and CSV upload.

---

## Table of Contents
- [Quick Start](#quick-start)
- [Python CLI (Plotly Express)](#python-cli-plotly-express)
  - [Environment Setup](#environment-setup)
  - [Commands](#commands)
  - [Input Data & Schemas](#input-data--schemas)
  - [Output](#output)
  - [Troubleshooting (Python)](#troubleshooting-python)
- [Web UI: Next.js + Tailwind + Plotly](#web-ui-nextjs--tailwind--plotly)
  - [Requirements](#requirements)
  - [Install & Run (Dev)](#install--run-dev)
  - [Pages & CSV Schemas](#pages--csv-schemas)
  - [Troubleshooting (Web)](#troubleshooting-web)
- [Project Structure](#project-structure)
- [Node / Python Versions](#node--python-versions)
- [Security Notes](#security-notes)
- [License](#license)

---

## Quick Start

### Python (one-liners)
```bash
# create conda env (first time)
conda env create -f environment.yml
conda activate median_viz

# generate visualizations
python viz.py --type pie
python viz.py --type bar
python viz.py --type map
```

### Web UI
```bash
# from repo root
cd apps/web-next
npm install
npm run dev
# http://localhost:3000  (see /pie, /bar, /map)
```

---

## Python CLI (Plotly Express)

The Python side is ideal for **static artifacts** you can publish or email as `.html`.

### Environment Setup
```bash
# If you don't have the env yet
conda env create -f environment.yml
conda activate median_viz

# Or, create manually:
conda create -n median_viz python=3.11 -y
conda activate median_viz
pip install -r requirements.txt   # if you have one
```

### Commands
```bash
# All outputs go to dist/ (HTML). If it doesn't exist, it's created.
python viz.py --type pie    # Federal revenue donut (animated by year)
python viz.py --type bar    # Bar chart example
python viz.py --type map    # US choropleth (animated by year)
```

Options:
- `--out PATH` — override output path (defaults inside `dist/`).
- `--csv PATH` — use your own CSV instead of the included sample.

### Input Data & Schemas

Default CSV files live under `data/`:
- `federal_revenue.csv` — for `--type pie`  
  Schema: `year,category,amount`

- `bar_sample.csv` — for `--type bar`  
  Schema: `time,category,value` (e.g., `2024-01`)

- `median_income_states.csv` — for `--type map`  
  **Flexible schema** (case-insensitive keys):
  - Preferred: `year,abbr,value`
  - Also accepted: `year,state,abbr,median_income`

> State codes should be USPS two-letter (`CA`, `TX`, `NY`, …).

### Output
- HTML files are written to `dist/` (e.g., `dist/pie.html`, `dist/bar.html`, `dist/map.html`).
- Open them in any browser; no server needed.

### Troubleshooting (Python)
- **`FileNotFoundError: dist/...`** — Create the `dist/` folder or let `viz.py` create it.  
- **Plotly not installed** — Ensure your conda env is active and `plotly` is installed.  
- **Choropleth shows blank** — Check that `abbr` uses USPS codes and numeric values are valid.

---

## Web UI: Next.js + Tailwind + Plotly

A modern, **pastel**-styled frontend with animated charts and client-side CSV upload.

> **Note:** Be sure to read the entire [Web guide](WEB_UI_GUIDE.md) for detailed instructions on setting up your Node environment and configuring the Web UI.

### Requirements
- **Node 20.x** (use `nvm use 20`)
- **Next.js 14.2.31** (declared in `apps/web-next/package.json`)
- macOS/Linux (Windows: WSL2 recommended)

### Install & Run (Dev)
```bash
cd apps/web-next
npm install
npm run dev
# open http://localhost:3000
```
If you want to run from the repo root, add a root `package.json` with scripts that proxy into `apps/web-next/`.

### Pages & CSV Schemas
- **/pie** — Animated donut.  
  CSV: `year,category,amount`

- **/bar** — Animated bar race.  
  CSV: `time,category,value`  (needs multiple distinct `time` rows to animate)

- **/map** — Animated US choropleth.  
  Accepts either:
  - `year,abbr,value` **or**
  - `year,state,abbr,median_income`  
  (Case-insensitive headers; extra columns are ignored. USPS 2-letter `abbr` required.)

> Upload CSV using the **Choose File** button. The chart re-renders and the slider/play controls animate across frames (years/time).

### Troubleshooting (Web)
- **`Module not found: clsx / tailwind-merge`** — Our UI now avoids these deps; if you re-introduce a `cn` helper, install them: `npm i clsx tailwind-merge`.
- **Plotly `_scrollZoom` or resize crash on /map** — We wrap Plotly with a stable height + `useResizeHandler`. If issues persist, restart dev:
  ```bash
  cd apps/web-next
  rm -rf .next
  npm run dev
  ```
- **Next config error (`next.config.ts` not supported)** — Use `next.config.mjs` on Next 14.
- **Node version mismatch** — Ensure `node -v` is 20.x (`nvm use 20`).

---

## Project Structure

```
median_viz/
├─ data/
│  ├─ federal_revenue.csv
│  ├─ bar_sample.csv
│  └─ median_income_states.csv
├─ dist/                     # Python outputs (HTML)
├─ viz.py                    # Python CLI entry
├─ environment.yml           # Conda environment
├─ apps/
│  └─ web-next/
│     ├─ app/
│     │  ├─ page.tsx        # Home
│     │  ├─ pie/page.tsx
│     │  ├─ bar/page.tsx
│     │  └─ map/page.tsx
│     ├─ components/
│     │  ├─ ClientPlot.tsx
│     │  ├─ CSVUpload.tsx
│     │  └─ ui/
│     │     ├─ button.tsx
│     │     ├─ card.tsx
│     │     ├─ input.tsx
│     │     └─ label.tsx
│     ├─ public/
│     ├─ package.json
│     └─ next.config.mjs
└─ README.md
```

---

## Node / Python Versions

- **Node**: 20.x (pinned via `.nvmrc` recommended)
- **Python**: 3.11 (as used in `environment.yml`)
- Make sure to **activate** the correct environment (`nvm use`, `conda activate`) before running respective apps.

---

## Security Notes
- Keep **Next.js** patched in the `14.2.x` line to avoid known CVEs. If `npm audit` flags Next, bump it.
- Lockfiles (`package-lock.json`) should be committed to keep deterministic installs.

---

## License

MIT License — free to use and adapt
