# Animated US-state choropleth (Median Income over time) — Dark Theme
# Usage:
#   conda activate <your-env>
#   pip install -r requirements.txt
#   python scripts/map_choropleth.py
# Output: dist/median_income_map.html

import pandas as pd
import plotly.express as px
import os

DATA = os.path.join(os.path.dirname(__file__), "..", "data", "median_income_states.csv")
OUT = os.path.join(os.path.dirname(__file__), "..", "dist", "median_income_map.html")

df = pd.read_csv(DATA)

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

# Improve animation controls
fig.layout.updatemenus[0].buttons[0].args[1]["frame"]["duration"] = 600
fig.layout.updatemenus[0].buttons[0].args[1]["transition"]["duration"] = 400

fig.write_html(OUT, include_plotlyjs="cdn", full_html=True)
print(f"Wrote: {OUT}")
