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
  ) => { ok: true } | { ok: false; code: 'invalid_date_range' }
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
      if (startDate > endDate) {
        return { ok: false, code: 'invalid_date_range' }
      }
      const state = store.getState()
      const currentFrame =
        state.animation.currentFrame < startDate ||
        state.animation.currentFrame > endDate
          ? startDate
          : state.animation.currentFrame
      apply(
        {
          selection: { startDate, endDate },
          animation: { currentFrame, playing: false },
        },
        'Changed the report-date range.',
        context
      )
      return { ok: true }
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
      if (!state.animation.enabled || !state.animation.playing) return
      const currentFrames = orderedFrames.filter(
        (frame) =>
          frame >= state.selection.startDate && frame <= state.selection.endDate
      )
      if (currentFrames.length < 2) return
      const index = currentFrames.indexOf(state.animation.currentFrame)
      apply(
        { animation: { currentFrame: currentFrames[(index + 1) % currentFrames.length] } },
        'Advanced the daily animation marker.'
      )
    },

    configureView(patch, context) {
      const state = store.getState()
      const comparisonDimension =
        patch.analysis?.comparisonDimension ?? state.analysis.comparisonDimension
      const comparisonChanged =
        patch.analysis?.comparisonDimension !== undefined &&
        patch.analysis.comparisonDimension !== state.analysis.comparisonDimension
      const chartType = patch.visualization?.chartType ?? (
        comparisonChanged
          ? compatibleChartForComparison(comparisonDimension, state.visualization.chartType)
          : state.visualization.chartType
      )
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
      const normalizedPatch: WorkspacePatch = {
        ...patch,
        ...(comparisonChanged && patch.visualization?.chartType === undefined
          ? { visualization: { chartType } }
          : {}),
        ...(comparisonChanged && patch.animation === undefined
          ? {
              animation: comparisonDimension === 'time'
                ? { playing: false }
                : { enabled: false, playing: false },
            }
          : {}),
      }
      apply(normalizedPatch, 'Configured the shared exploration view.', context)
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
