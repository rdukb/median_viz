import type { AnalyticalQuery } from '../analysis/types'
import type { WorkspaceState } from './types'

export const workspaceStateToQuery = (
  state: WorkspaceState,
  options: { ignoreAnimation?: boolean } = {}
): AnalyticalQuery => ({
  demographicDimensions: [state.analysis.demographicDimension],
  comparisonDimension: state.analysis.comparisonDimension,
  metric: state.analysis.metric,
  filters: state.selection.filters,
  startDate: state.selection.startDate,
  endDate: state.selection.endDate,
  animationEnabled: state.animation.enabled,
  currentFrame: state.animation.currentFrame,
  ignoreAnimation: options.ignoreAnimation,
})

export const datesInWorkspaceRange = (state: WorkspaceState, dates: string[]) =>
  dates.filter(
    (date) => date >= state.selection.startDate && date <= state.selection.endDate
  )
