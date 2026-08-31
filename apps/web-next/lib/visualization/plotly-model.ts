import { cellValue } from '../analysis/query'
import { metricLabel } from '../analysis/metrics'
import type { AnalyticalQuerySuccess } from '../analysis/types'
import { demographicDimensionLabel } from '../dataset/types'
import { assertPublicDemoComparisonValues } from '../dataset/public-demo-identities'
import type { WorkspaceState } from '../workspace/types'

const pastel = ['#6c63e7', '#e95f9c', '#37b5a0', '#e7aa36', '#8766d7', '#4596d7']

export type PlotlyModel = {
  data: any[]
  layout: any
}

export function buildPlotlyModel(
  result: AnalyticalQuerySuccess,
  state: WorkspaceState
): PlotlyModel {
  const metric = state.analysis.metric
  const comparison = state.analysis.comparisonDimension
  if (comparison === 'product_campaign' || comparison === 'product_ad_set') {
    assertPublicDemoComparisonValues(comparison, result.comparisonValues)
  }
  const baseLayout: any = {
    autosize: true,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, ui-sans-serif, system-ui', color: '#334155', size: 12 },
    margin: { l: 64, r: 24, t: 36, b: 72 },
    hoverlabel: {
      bgcolor: '#ffffff',
      bordercolor: '#e2e8f0',
      font: { color: '#0f172a' },
    },
    showlegend: comparison !== 'none',
    legend: { orientation: 'h', y: -0.22, x: 0 },
  }

  if (comparison === 'time') {
    return {
      data: result.demographicValues.map((demographicValue, index) => ({
        type: 'scatter',
        mode: 'lines+markers',
        name: demographicValue,
        x: result.comparisonValues,
        y: result.comparisonValues.map((date) =>
          cellValue(result.cells, demographicValue, date)
        ),
        line: { color: pastel[index % pastel.length], width: 3, shape: 'spline' },
        marker: { size: 6 },
        hovertemplate: `%{x}<br>${metricLabel(metric)}: %{y:.2f}<extra>${demographicValue}</extra>`,
      })),
      layout: {
        ...baseLayout,
        xaxis: { title: 'Report date', fixedrange: true },
        yaxis: {
          title: metricLabel(metric),
          gridcolor: '#edf0f7',
          zeroline: false,
          fixedrange: true,
        },
        shapes: state.animation.enabled
          ? [{
              type: 'line',
              x0: state.animation.currentFrame,
              x1: state.animation.currentFrame,
              y0: 0,
              y1: 1,
              yref: 'paper',
              line: { color: '#e95f9c', width: 3, dash: 'dot' },
            }]
          : [],
      },
    }
  }

  if (state.visualization.chartType === 'heatmap') {
    return {
      data: [{
        type: 'heatmap',
        x: result.demographicValues,
        y: result.comparisonValues,
        z: result.comparisonValues.map((comparisonValue) =>
          result.demographicValues.map((demographicValue) =>
            cellValue(result.cells, demographicValue, comparisonValue)
          )
        ),
        colorscale: [[0, '#f6f3ff'], [0.5, '#a6b8ff'], [1, '#6255d5']],
        colorbar: { title: metricLabel(metric), thickness: 12 },
        hovertemplate: `%{x}<br>%{y}<br>${metricLabel(metric)}: %{z:.2f}<extra></extra>`,
      }],
      layout: {
        ...baseLayout,
        margin: { ...baseLayout.margin, l: 170 },
        xaxis: {
          title: demographicDimensionLabel(state.analysis.demographicDimension),
          fixedrange: true,
        },
        yaxis: { title: comparisonLabel(comparison), automargin: true, fixedrange: true },
      },
    }
  }

  const highlight = state.analysis.highlightMode === 'high-cpa' && metric === 'cpa'
    ? [...result.cells]
        .filter((cell) => cell.value !== null)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]?.demographicValue
    : null

  return {
    data: result.comparisonValues.map((comparisonValue, index) => ({
      type: 'bar',
      name: comparisonValue,
      x: result.demographicValues,
      y: result.demographicValues.map((demographicValue) =>
        cellValue(result.cells, demographicValue, comparisonValue)
      ),
      marker: {
        color: highlight
          ? result.demographicValues.map((value) =>
              value === highlight ? '#e95f9c' : '#9eaff4'
            )
          : pastel[index % pastel.length],
        line: { color: '#ffffff', width: 1 },
      },
      hovertemplate: `%{x}<br>${metricLabel(metric)}: %{y:.2f}<extra>${comparisonValue}</extra>`,
    })),
    layout: {
      ...baseLayout,
      barmode: 'group',
      xaxis: {
        title: demographicDimensionLabel(state.analysis.demographicDimension),
        automargin: true,
        fixedrange: true,
      },
      yaxis: {
        title: metricLabel(metric),
        gridcolor: '#edf0f7',
        zeroline: false,
        fixedrange: true,
      },
    },
  }
}

export const comparisonLabel = (comparison: WorkspaceState['analysis']['comparisonDimension']) => {
  switch (comparison) {
    case 'none': return 'None'
    case 'product_ad_set': return 'Product Ad Set'
    case 'product_campaign': return 'Product Campaign'
    case 'time': return 'Time'
  }
}
