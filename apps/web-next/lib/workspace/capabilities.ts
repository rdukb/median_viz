import type { ComparisonDimension, MetricKey } from '../analysis/types'
import { demographicDimensionLabel, type DemographicDimension } from '../dataset/types'
import {
  assertPublicDemoFilterValue,
  publicDemoAgentActivityLabel,
} from '../dataset/public-demo-identities'
import {
  compatibleChartForComparison,
  isChartAllowed,
} from '../visualization/chart-policy'
import type {
  CapabilityContext,
  ChartType,
  WorkspaceAction,
  WorkspaceFilterName,
  WorkspacePatch,
  WorkspaceState,
} from './types'

type WorkspaceStore = {
  getState: () => WorkspaceState
  dispatch: (action: WorkspaceAction) => void
}

export type AnimationUpdate = Partial<WorkspaceState['animation']>

export type WorkspaceCapabilities = {
  setMetric: (metric: MetricKey, context?: CapabilityContext) => void
  setDemographicDimension: (
    dimension: DemographicDimension,
    context?: CapabilityContext
  ) => void
  setComparisonDimension: (
    comparison: ComparisonDimension,
    context?: CapabilityContext
  ) => void
  applyFilter: (
    filter: WorkspaceFilterName,
    value: string,
    context?: CapabilityContext
  ) => void
  setDateRange: (
    startDate: string,
    endDate: string,
    context?: CapabilityContext
  ) => void
  setVisualization: (
    chartType: ChartType,
    context?: CapabilityContext
  ) => { ok: true } | { ok: false; code: 'unsupported_visualization_combination' }
  setAnimation: (update: AnimationUpdate, context?: CapabilityContext) => void
  advanceAnimationFrame: (orderedFrames: string[]) => void
  configureView: (
    patch: WorkspacePatch,
    context?: CapabilityContext
  ) =>
    | { ok: true }
    | {
        ok: false
        error: {
          code: 'unsupported_visualization_combination'
          message: string
          details: {
            comparisonDimension: ComparisonDimension
            chartType: ChartType
          }
        }
      }
  resetView: (context?: CapabilityContext) => void
  getState: () => WorkspaceState
}

const actor = (context?: CapabilityContext) => context?.actor ?? 'human'
const activityLabel = (label: string, context?: CapabilityContext) =>
  context?.actor === 'agent'
    ? publicDemoAgentActivityLabel(context.activityKey)
    : label

export function createWorkspaceCapabilities(
  store: WorkspaceStore
): WorkspaceCapabilities {
  const apply = (
    patch: WorkspacePatch,
    label: string,
    context?: CapabilityContext
  ) => store.dispatch({
    type: 'apply_patch',
    actor: actor(context),
    label: activityLabel(label, context),
    patch,
  })

  return {
    setMetric(metric, context) {
      apply(
        { analysis: { metric, highlightMode: 'none' } },
        `Changed metric to ${metric}.`,
        context
      )
    },

    setDemographicDimension(demographicDimension, context) {
      apply(
        { analysis: { demographicDimension, highlightMode: 'none' } },
        `Switched pivot to ${demographicDimensionLabel(demographicDimension)}.`,
        context
      )
    },

    setComparisonDimension(comparisonDimension, context) {
      const state = store.getState()
      apply(
        {
          analysis: { comparisonDimension, highlightMode: 'none' },
          visualization: {
            chartType: compatibleChartForComparison(
              comparisonDimension,
              state.visualization.chartType
            ),
          },
          animation: comparisonDimension === 'time'
            ? { playing: false }
            : { enabled: false, playing: false },
        },
        `Changed comparison to ${comparisonDimension}.`,
        context
      )
    },

    applyFilter(filter, value, context) {
      assertPublicDemoFilterValue(filter, value)
      const state = store.getState()
      const filters = filter === 'productCampaignId'
        ? { productCampaignId: value, productAdSetId: 'all' }
        : { ...state.selection.filters, productAdSetId: value }
      apply(
        { selection: { filters }, analysis: { highlightMode: 'none' } },
        `Applied ${filter} filter.`,
        context
      )
    },

    setDateRange(startDate, endDate, context) {
      const state = store.getState()
      const normalizedStart = startDate <= endDate ? startDate : endDate
      const normalizedEnd = startDate <= endDate ? endDate : startDate
      const currentFrame =
        state.animation.currentFrame < normalizedStart ||
        state.animation.currentFrame > normalizedEnd
          ? normalizedStart
          : state.animation.currentFrame
      apply(
        {
          selection: { startDate: normalizedStart, endDate: normalizedEnd },
          animation: { currentFrame, playing: false },
        },
        'Changed the report-date range.',
        context
      )
    },

    setVisualization(chartType, context) {
      const state = store.getState()
      if (!isChartAllowed(state.analysis.comparisonDimension, chartType)) {
        return { ok: false, code: 'unsupported_visualization_combination' }
      }
      apply(
        { visualization: { chartType }, analysis: { highlightMode: 'none' } },
        `Changed chart to ${chartType}.`,
        context
      )
      return { ok: true }
    },

    setAnimation(update, context) {
      apply({ animation: update }, 'Changed daily animation.', context)
    },

    advanceAnimationFrame(orderedFrames) {
      const state = store.getState()
      if (orderedFrames.length < 2) return
      const index = orderedFrames.indexOf(state.animation.currentFrame)
      apply(
        { animation: { currentFrame: orderedFrames[(index + 1) % orderedFrames.length] } },
        'Advanced the daily animation marker.'
      )
    },

    configureView(patch, context) {
      const state = store.getState()
      const comparisonDimension =
        patch.analysis?.comparisonDimension ?? state.analysis.comparisonDimension
      const chartType = patch.visualization?.chartType ?? state.visualization.chartType
      if (!isChartAllowed(comparisonDimension, chartType)) {
        return {
          ok: false,
          error: {
            code: 'unsupported_visualization_combination',
            message: `Chart ${chartType} is not supported for comparison ${comparisonDimension}.`,
            details: { comparisonDimension, chartType },
          },
        }
      }
      apply(patch, 'Configured the shared exploration view.', context)
      return { ok: true }
    },

    resetView(context) {
      store.dispatch({
        type: 'reset_view',
        actor: actor(context),
        label: activityLabel('Reset the exploration view.', context),
      })
    },

    getState: store.getState,
  }
}
