#!/usr/bin/env python3
"""
Unified entry point for generating dark-themed visualizations.

Usage examples:
  python viz.py --type map
  python viz.py --type bar --top-n 10
  python viz.py --type bar --data data/bar_race_sample.csv --out dist/custom_bar.html
  python viz.py --type map --data data/median_income_states.csv --out dist/custom_map.html

Requirements:
  pip install -r requirements.txt
"""

from __future__ import annotations
import argparse
from pathlib import Path
import sys
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DIST_DIR = ROOT / "dist"
DEFAULT_BAR_CSV = DATA_DIR / "bar_race_sample.csv"
DEFAULT_MAP_CSV = DATA_DIR / "median_income_states.csv"


def build_bar_race(data_csv: Path, out_html: Path, top_n: int = 8):
    """Animated horizontal bar 'race'."""
    df = pd.read_csv(data_csv)

    # Validate columns
    required = {"time", "category", "value"}
    if not required.issubset(df.columns):
        raise ValueError(f"Bar race data must contain columns: {sorted(required)} — got {list(df.columns)}")

    # Keep top-N per time frame
    frames = sorted(df["time"].astype(str).unique())
    filtered = (
        pd.concat([
            df[df["time"].astype(str) == f].sort_values("value", ascending=False).head(top_n)
            for f in frames
        ], ignore_index=True)
        .sort_values(["time", "value"], ascending=[True, False])
    )

    fig = px.bar(
        filtered,
        x="value",
        y="category",
        orientation="h",
        animation_frame="time",
        range_x=[0, filtered["value"].max() * 1.1],
        text="value",
        title=f"Top Categories Over Time (Top {top_n})"
    )

    # Dark theme polish
    fig.update_traces(texttemplate="%{text:,.0f}", textposition="outside", cliponaxis=False)
    fig.update_layout(
        template="plotly_dark",
        title_font_size=22,
        font=dict(family="Inter, Segoe UI, Roboto, Arial", size=14, color="#e5e7eb"),
        margin=dict(l=10, r=10, t=60, b=10),
        paper_bgcolor="#0b0f14",
        plot_bgcolor="#0b0f14",
        xaxis=dict(gridcolor="#1f2937", title="Value"),
        yaxis=dict(gridcolor="#1f2937", title=""),
        showlegend=False
    )

    # Animation pacing
    if fig.layout.updatemenus and fig.layout.updatemenus[0].buttons:
        fig.layout.updatemenus[0].buttons[0].args[1]["frame"]["duration"] = 500
        fig.layout.updatemenus[0].buttons[0].args[1]["transition"]["duration"] = 350

    out_html.parent.mkdir(parents=True, exist_ok=True)
    fig.write_html(str(out_html), include_plotlyjs="cdn", full_html=True)
    print(f"Wrote: {out_html}")


def build_map(data_csv: Path, out_html: Path):
    """Animated US-state choropleth over time."""
    df = pd.read_csv(data_csv)

    required = {"year", "state", "abbr", "median_income"}
    if not required.issubset(df.columns):
        raise ValueError(f"Map data must contain columns: {sorted(required)} — got {list(df.columns)}")

    # Ensure correct dtypes
    df["year"] = df["year"].astype(str)

    fig = px.choropleth(
        df,
        locations="abbr",
        locationmode="USA-states",
        color="median_income",
        hover_name="state",
        hover_data={"median_income":":,","year":True, "abbr":False},
        animation_frame="year",
        color_continuous_scale="Viridis",
        scope="usa",
        title="Median Household Income by US State (Animated)"
    )

    # Dark theme polish
    fig.update_layout(
        template="plotly_dark",
        title_font_size=22,
        font=dict(family="Inter, Segoe UI, Roboto, Arial", size=14),
        margin=dict(l=10, r=10, t=60, b=10),
        paper_bgcolor="#0b0f14",
        plot_bgcolor="#0b0f14",
        coloraxis_colorbar=dict(title="Income", tickformat="~s")
    )

    # Animation pacing
    if fig.layout.updatemenus and fig.layout.updatemenus[0].buttons:
        fig.layout.updatemenus[0].buttons[0].args[1]["frame"]["duration"] = 600
        fig.layout.updatemenus[0].buttons[0].args[1]["transition"]["duration"] = 400

    out_html.parent.mkdir(parents=True, exist_ok=True)
    fig.write_html(str(out_html), include_plotlyjs="cdn", full_html=True)
    print(f"Wrote: {out_html}")


def build_pie(data_csv: Path, out_html: Path):
    """
    Animated pie (donut) of federal revenue composition over years.
    CSV must have columns: year, category, amount
    Keeps colors stable per category across frames.
    """
    import numpy as np
    df = pd.read_csv(data_csv)
    required = {"year", "category", "amount"}
    if not required.issubset(df.columns):
        raise ValueError(f"Pie data must have columns: {sorted(required)}")

    # Normalize types
    df["year"] = df["year"].astype(str)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)

    # Stable orders & color map
    cats = sorted(df["category"].unique().tolist())
    try:
        years = sorted(df["year"].unique(), key=lambda y: int(y))
    except Exception:
        years = sorted(df["year"].unique())

    palette = px.colors.qualitative.Pastel
    color_map = {c: palette[i % len(palette)] for i, c in enumerate(cats)}
    colors = [color_map[c] for c in cats]

    # Pivot to ensure every (year, category) exists; missing -> 0
    pivot = (
        df.pivot_table(index="year", columns="category", values="amount", aggfunc="sum")
          .reindex(index=years, columns=cats)
          .fillna(0)
    )

    # Initial frame
    init_year = years[0]
    init_vals = pivot.loc[init_year].values

    fig = go.Figure(
        data=[
            go.Pie(
                labels=cats,
                values=init_vals,
                hole=0.3,
                sort=False,
                marker=dict(colors=colors),
                textinfo="label+percent",
                hovertemplate="%{label}<br>%{value:,} B<extra></extra>",
            )
        ]
    )

    # Build frames (one per year)
    frames = []
    for y in years:
        vals = pivot.loc[y].values
        frames.append(
            go.Frame(
                name=str(y),
                data=[
                    go.Pie(
                        labels=cats,
                        values=vals,
                        hole=0.3,
                        sort=False,
                        marker=dict(colors=colors),
                        textinfo="label+percent",
                        hovertemplate="%{label}<br>%{value:,} B<extra></extra>",
                    )
                ],
            )
        )
    fig.frames = frames

    # Dark theme & animation controls
    fig.update_layout(
        template="plotly_white",
        title="Federal Revenue by Tax Type — Animated",
        title_font_size=22,
        font=dict(family="Inter, Segoe UI, Roboto, Arial", size=14, color="#222"),
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        legend_title_text="Tax Type",
        # font=dict(family="Inter, Segoe UI, Roboto, Arial", size=14, color="#222"),
        margin=dict(l=10, r=10, t=60, b=10),
        updatemenus=[
            dict(
                type="buttons",
                showactive=False,
                x=0.02, y=1.12, xanchor="left", yanchor="top",
                buttons=[
                    dict(
                        label="▶ Play",
                        method="animate",
                        args=[
                            None,
                            {
                                "frame": {"duration": 800, "redraw": True},
                                "transition": {"duration": 400},
                                "fromcurrent": True,
                            },
                        ],
                    ),
                    dict(
                        label="⏸ Pause",
                        method="animate",
                        args=[
                            [None],
                            {
                                "mode": "immediate",
                                "frame": {"duration": 0, "redraw": False},
                                "transition": {"duration": 0},
                            },
                        ],
                    ),
                ],
            )
        ],
        sliders=[
            {
                "active": 0,
                "x": 0.1, "y": 0.02,
                "len": 0.8,
                "currentvalue": {"prefix": "Year: ", "font": {"size": 16, "color": "#222"}},
                "pad": {"t": 30, "b": 10},
                "steps": [
                    {
                        "label": str(y),
                        "method": "animate",
                        "args": [
                            [str(y)],
                            {
                                "mode": "immediate",
                                "frame": {"duration": 0, "redraw": True},
                                "transition": {"duration": 0},
                            },
                        ],
                    }
                    for y in years
                ],
            }
        ],
    )

    out_html.parent.mkdir(parents=True, exist_ok=True)
    fig.write_html(str(out_html), include_plotlyjs="cdn", full_html=True)
    print(f"Wrote: {out_html}")


def main():
    parser = argparse.ArgumentParser(description="Generate visualizations (dark themed).")
    parser.add_argument("--type", choices=["map", "bar", "pie"], required=True, help="Which viz to generate")
    parser.add_argument("--data", type=Path, help="Path to CSV data (optional).")
    parser.add_argument("--out", type=Path, help="Output HTML path (optional).")
    parser.add_argument("--top-n", type=int, default=8, help="Top N bars to show (bar type only).")
    args = parser.parse_args()

    DIST_DIR.mkdir(parents=True, exist_ok=True)

    if args.type == "bar":
        data_csv = args.data or DEFAULT_BAR_CSV
        out_html = args.out or (DIST_DIR / "bar_race.html")
        build_bar_race(data_csv, out_html, top_n=args.top_n)

    elif args.type == "map":
        data_csv = args.data or DEFAULT_MAP_CSV
        out_html = args.out or (DIST_DIR / "median_income_map.html")
        build_map(data_csv, out_html)
    elif args.type == "pie":
        data_csv = args.data or (DATA_DIR / "federal_revenue.csv")
        out_html = args.out or (DIST_DIR / "federal_revenue_pie.html")
        build_pie(data_csv, out_html)

    else:
        print("Unknown type.", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
