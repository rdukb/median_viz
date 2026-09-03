import type { ComparisonDimension } from '../analysis/types'
import type { ChartType } from '../workspace/types'

export function isChartAllowed(
  comparison: ComparisonDimension,
  chartType: ChartType
) {
  if (comparison === 'time') return chartType === 'line'
  if (comparison === 'none') return chartType === 'bar'
  return chartType === 'bar' || chartType === 'heatmap'
}

export function compatibleChartForComparison(
  comparison: ComparisonDimension,
  current: ChartType
): ChartType {
  if (comparison === 'time') return 'line'
  if (comparison === 'none') return 'bar'
  return current === 'heatmap' ? 'heatmap' : 'bar'
}
