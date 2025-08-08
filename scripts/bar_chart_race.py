# Animated bar "race" with Plotly — Dark Theme
# Usage:
#   conda activate <your-env>
#   pip install -r requirements.txt
#   python scripts/bar_chart_race.py
# Output: dist/bar_race.html

import pandas as pd
import plotly.express as px
import os

DATA = os.path.join(os.path.dirname(__file__), "..", "data", "bar_race_sample.csv")
OUT = os.path.join(os.path.dirname(__file__), "..", "dist", "bar_race.html")

df = pd.read_csv(DATA)

# Keep top-N per frame to make it feel like a 'race'
TOP_N = 8
def filter_top(frame):
    # frame is YYYY-MM; we select top-N
    sub = df[df["time"] == frame].sort_values("value", ascending=False).head(TOP_N)
    return sub

frames = sorted(df["time"].unique())
filtered = pd.concat([filter_top(f) for f in frames], ignore_index=True)

fig = px.bar(
    filtered.sort_values(["time","value"], ascending=[True, False]),
    x="value",
    y="category",
    orientation="h",
    animation_frame="time",
    range_x=[0, filtered["value"].max() * 1.1],
    text="value",
    title="Top Categories Over Time"
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
fig.layout.updatemenus[0].buttons[0].args[1]["frame"]["duration"] = 500
fig.layout.updatemenus[0].buttons[0].args[1]["transition"]["duration"] = 350

fig.write_html(OUT, include_plotlyjs="cdn", full_html=True)
print(f"Wrote: {OUT}")
