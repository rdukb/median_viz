# Median Income & Revenue Visualizations

This project contains three ready-to-run **Plotly** visualizations created using **ChatGPT GPT-5** (all export to self-contained HTML files):

1. **Animated US-state choropleth** of median income over time
   (`--type map`)
2. **Animated bar race** showing top categories over time
   (`--type bar`)
3. **Animated pie/donut** showing federal revenue composition over years
   (`--type pie`)

---

## Quick Start (Conda)

```bash
# 1) Create & activate environment
conda create -n median_viz python=3.11 -y
conda activate median_viz

# 2) Install dependencies
pip install -r requirements.txt

# 3) Generate a visualization
# Map of median income over time
python viz.py --type map

# Bar race (top 8 categories)
python viz.py --type bar --top-n 8

# Animated pie chart of federal revenue
python viz.py --type pie
```

Outputs will be in the `dist/` folder:

* `median_income_map.html`
* `bar_race.html`
* `federal_revenue_pie.html`

Open them in your browser by double-clicking or with:

```bash
open dist/median_income_map.html   # macOS
start dist\median_income_map.html  # Windows
```

---

## Using your own data

### Map (`--type map`)

CSV columns:

* `year` — e.g., `2018`
* `state` — full state name
* `abbr` — two-letter state code (e.g., CA, NY)
* `median_income` — numeric value

Example: `data/median_income_states.csv`

### Bar race (`--type bar`)

CSV columns:

* `time` — sortable frame key (e.g., `YYYY-MM`)
* `category` — name
* `value` — number

Example: `data/bar_race_sample.csv`

`--top-n` controls how many bars are displayed per frame.

### Pie (`--type pie`)

CSV columns:

* `year` — e.g., `2024`
* `category` — name
* `amount` — number (e.g., billions USD)

Example: `data/federal_revenue.csv`

---

## Theme customization

* **Dark theme** (default in map/bar): `template="plotly_dark"` in the function.
* **Light pastel theme** (pie): switch to

  ```python
  palette = px.colors.qualitative.Pastel
  template="plotly_white"
  paper_bgcolor="#ffffff"
  plot_bgcolor="#ffffff"
  font=dict(color="#222")
  ```
* You can adjust colors, fonts, and animation speed directly in the corresponding `build_*` function in `viz.py`.

---

## Command Reference

```bash
python viz.py --type map [--data path/to.csv] [--out path/to.html]
python viz.py --type bar [--data path/to.csv] [--out path/to.html] [--top-n 8]
python viz.py --type pie [--data path/to.csv] [--out path/to.html]
```

If `--data` is not provided, defaults from the `data/` folder are used.

---

## License

MIT License — free to use and adapt.
