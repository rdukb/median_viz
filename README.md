# Median Income Visualizations (Dark Theme, Python)

Two ready-to-run visualizations using **Plotly** created using **ChatGPT GPT-5** (works great in a Conda env):

1. **Animated US-state choropleth** of median income over time  
   Output: `dist/median_income_map.html`

2. **Animated bar "race"** for categories over time  
   Output: `dist/bar_race.html`

---

## Quick Start (Conda)

```bash
# 1) Activate your env (or create one)
conda create -n viz python=3.11 -y
conda activate viz

# 2) Install deps
pip install -r requirements.txt

# 3) Run either (or both)
python scripts/map_choropleth.py
python scripts/bar_chart_race.py

# 4) Open the generated HTML
open dist/median_income_map.html   # macOS
# or
start dist\median_income_map.html # Windows
# or simply double-click the file
```

## Use your own data

### Choropleth (map)
- Put your CSV at `data/median_income_states.csv` with columns:
  - `year` — integer or string year (e.g., 2015)
  - `state` — full state name
  - `abbr` — two-letter state code (e.g., CA, NY)
  - `median_income` — numeric
- Edit `scripts/map_choropleth.py` `DATA` path if you rename your file.

### Bar race
- CSV at `data/bar_race_sample.csv` with columns:
  - `time` — sortable frame key (YYYY-MM recommended)
  - `category` — name
  - `value` — number
- Tweak `TOP_N` in the script to control how many bars appear.

## Notes
- The dark theme is set via `template="plotly_dark"` plus custom background/grid colors.
- Outputs are self-contained HTML files (load Plotly from CDN). No server required.
