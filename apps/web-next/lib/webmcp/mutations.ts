import { metricDefinitions } from '../analysis/metrics'
import { executeAnalyticalQuery } from '../analysis/query'
import type { ComparisonDimension, MetricKey } from '../analysis/types'
import {
  assertPublicDemoFilterValue,
  PUBLIC_DEMO_PRODUCT_AD_SETS,
} from '../dataset/public-demo-identities'
import {
  demographicDimensionDefinitions,
  type DemographicDimension,
  type DemographicDataset,
} from '../dataset/types'
import type { WorkspaceCapabilities } from '../workspace/capabilities'
import { workspaceStateToQuery } from '../workspace/selectors'
import type { ChartType, WorkspacePatch, WorkspaceState } from '../workspace/types'
import {
  assertBoundedSerializableOutput,
  serializeMutationStateSummary,
  type StudioWebMcpSnapshot,
} from './serializers'

type MutationInput = Record<string, unknown>
type MutationError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

const metricKeys = new Set<string>(metricDefinitions.map((metric) => metric.key))
const demographicDimensions = new Set<string>(
  demographicDimensionDefinitions.map((dimension) => dimension.key)
)
const comparisonDimensions = new Set<string>(['none', 'product_ad_set', 'product_campaign', 'time'])
const chartTypes = new Set<string>(['bar', 'heatmap', 'line'])
const reportDates = new Set<string>(Array.from({ length: 14 }, (_, index) =>
  `2026-08-${String(8 + index).padStart(2, '0')}`
))
const mutationWarnings = [
  'This changes only the visible browser workspace; it does not write dataset rows or persist data.',
  'Demographic evidence remains daily provisional, directional, privacy adjusted, and one pivot at a time.',
]

const isRecord = (input: unknown): input is MutationInput =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

function failure(state: WorkspaceState, error: MutationError) {
  return assertBoundedSerializableOutput({
    ok: false as const,
    previousRevision: state.runtime.revision,
    newRevision: state.runtime.revision,
    error,
  })
}

function invalid(state: WorkspaceState, field: string, message: string) {
  return failure(state, {
    code: 'invalid_tool_input',
    message,
    details: { field },
  })
}

function validateEnvelope(
  input: unknown,
  state: WorkspaceState,
  allowedKeys: string[]
): { ok: true; input: MutationInput } | { ok: false; result: ReturnType<typeof invalid> } {
  if (!isRecord(input)) {
    return { ok: false, result: invalid(state, 'input', 'Tool input must be an object.') }
  }
  const unexpected = Object.keys(input).find((key) => !allowedKeys.includes(key))
  if (unexpected) {
    return { ok: false, result: invalid(state, unexpected, 'Tool input contains an unsupported field.') }
  }
  if (
    input.expectedRevision !== undefined &&
    (!Number.isInteger(input.expectedRevision) || Number(input.expectedRevision) < 0)
  ) {
    return { ok: false, result: invalid(state, 'expectedRevision', 'expectedRevision must be a non-negative integer.') }
  }
  if (
    input.expectedRevision !== undefined &&
    input.expectedRevision !== state.runtime.revision
  ) {
    return {
      ok: false,
      result: failure(state, {
        code: 'stale_workspace_revision',
        message: 'The visible workspace changed after the agent inspected it. Read the workspace again before retrying.',
        details: {
          expectedRevision: input.expectedRevision,
          actualRevision: state.runtime.revision,
        },
      }),
    }
  }
  return { ok: true, input }
}

function success(
  before: WorkspaceState,
  after: WorkspaceState,
  warnings: string[] = mutationWarnings
) {
  if (after.runtime.revision !== before.runtime.revision + 1) {
    throw new Error('A successful WebMCP mutation must increment the workspace revision exactly once.')
  }
  if (after.dataset !== before.dataset) {
    throw new Error('WebMCP mutation attempted to replace immutable dataset identity state.')
  }
  return assertBoundedSerializableOutput({
    ok: true as const,
    noOp: false,
    previousRevision: before.runtime.revision,
    newRevision: after.runtime.revision,
    state: serializeMutationStateSummary(after),
    warnings: warnings.slice(0, 4),
  })
}

function noOp(state: WorkspaceState, message: string) {
  return assertBoundedSerializableOutput({
    ok: true as const,
    noOp: true,
    previousRevision: state.runtime.revision,
    newRevision: state.runtime.revision,
    state: serializeMutationStateSummary(state),
    warnings: [message, ...mutationWarnings].slice(0, 4),
  })
}

function completeCapabilityMutation(
  capabilities: WorkspaceCapabilities,
  before: WorkspaceState,
  capabilityResult: ReturnType<WorkspaceCapabilities['configureView']>
) {
  if (!capabilityResult.ok) return failure(before, capabilityResult.error)
  return success(before, capabilities.getState())
}

function canonicalAdSetCampaign(productAdSetId: string) {
  return PUBLIC_DEMO_PRODUCT_AD_SETS.find(
    (adSet) => adSet.productAdSetId === productAdSetId
  )?.productCampaignId
}

export type StudioMutationExecutors = ReturnType<typeof createStudioMutationExecutors>

export function createStudioMutationExecutors(
  dataset: DemographicDataset,
  capabilities: WorkspaceCapabilities,
  readSnapshot: () => StudioWebMcpSnapshot
) {
  return {
    configureAnalysis(inputValue: unknown) {
      const before = capabilities.getState()
      const envelope = validateEnvelope(inputValue, before, [
        'metric', 'demographicDimension', 'comparisonDimension', 'visualization', 'expectedRevision',
      ])
      if (!envelope.ok) return envelope.result
      const input = envelope.input
      if (!['metric', 'demographicDimension', 'comparisonDimension', 'visualization'].some((key) => input[key] !== undefined)) {
        return invalid(before, 'input', 'At least one analysis configuration field is required.')
      }

      if (Array.isArray(input.demographicDimension)) {
        if (
          input.demographicDimension.length < 2 ||
          input.demographicDimension.some((value) => typeof value !== 'string' || !demographicDimensions.has(value))
        ) {
          return invalid(before, 'demographicDimension', 'Demographic dimensions must use approved pivot values.')
        }
        const validation = executeAnalyticalQuery(dataset, {
          ...workspaceStateToQuery(before),
          demographicDimensions: input.demographicDimension as DemographicDimension[],
        })
        if (!validation.ok) return failure(before, validation.error)
        return invalid(before, 'demographicDimension', 'Exactly one demographic dimension is required.')
      }
      if (
        input.metric !== undefined &&
        (typeof input.metric !== 'string' || !metricKeys.has(input.metric))
      ) return invalid(before, 'metric', 'Metric must use an approved value.')
      if (
        input.demographicDimension !== undefined &&
        (typeof input.demographicDimension !== 'string' || !demographicDimensions.has(input.demographicDimension))
      ) return invalid(before, 'demographicDimension', 'Demographic dimension must use one approved pivot.')
      if (
        input.comparisonDimension !== undefined &&
        (typeof input.comparisonDimension !== 'string' || !comparisonDimensions.has(input.comparisonDimension))
      ) return invalid(before, 'comparisonDimension', 'Comparison dimension must use an approved value.')
      if (
        input.visualization !== undefined &&
        (typeof input.visualization !== 'string' || !chartTypes.has(input.visualization))
      ) return invalid(before, 'visualization', 'Visualization must use an approved value.')

      const patch: WorkspacePatch = {
        analysis: {
          ...(input.metric !== undefined ? { metric: input.metric as MetricKey } : {}),
          ...(input.demographicDimension !== undefined
            ? { demographicDimension: input.demographicDimension as DemographicDimension }
            : {}),
          ...(input.comparisonDimension !== undefined
            ? { comparisonDimension: input.comparisonDimension as ComparisonDimension }
            : {}),
          highlightMode: 'none',
        },
        ...(input.visualization !== undefined
          ? { visualization: { chartType: input.visualization as ChartType } }
          : {}),
      }
      const alreadyConfigured =
        (input.metric === undefined || input.metric === before.analysis.metric) &&
        (input.demographicDimension === undefined ||
          input.demographicDimension === before.analysis.demographicDimension) &&
        (input.comparisonDimension === undefined ||
          input.comparisonDimension === before.analysis.comparisonDimension) &&
        (input.visualization === undefined ||
          input.visualization === before.visualization.chartType) &&
        before.analysis.highlightMode === 'none'
      if (alreadyConfigured) {
        return noOp(before, 'The requested analysis configuration is already active.')
      }
      return completeCapabilityMutation(
        capabilities,
        before,
        capabilities.configureView(patch, {
          actor: 'agent',
          activityKey: 'webmcpConfigureAnalysis',
        })
      )
    },

    applyFilters(inputValue: unknown) {
      const before = capabilities.getState()
      const envelope = validateEnvelope(inputValue, before, [
        'mode', 'productCampaignId', 'productAdSetId', 'startDate', 'endDate', 'expectedRevision',
      ])
      if (!envelope.ok) return envelope.result
      const input = envelope.input
      if (input.mode !== 'replace') {
        return invalid(before, 'mode', 'The current workspace supports replace filter semantics only.')
      }
      if (!['productCampaignId', 'productAdSetId', 'startDate', 'endDate'].some((key) => input[key] !== undefined)) {
        return invalid(before, 'input', 'At least one filter field is required.')
      }

      try {
        if (input.productCampaignId !== undefined) {
          if (typeof input.productCampaignId !== 'string') throw new Error()
          assertPublicDemoFilterValue('productCampaignId', input.productCampaignId)
        }
        if (input.productAdSetId !== undefined) {
          if (typeof input.productAdSetId !== 'string') throw new Error()
          assertPublicDemoFilterValue('productAdSetId', input.productAdSetId)
        }
      } catch {
        return invalid(before, 'identity', 'Filters may use only canonical Northstar demo identities.')
      }

      const productCampaignId = (input.productCampaignId as string | undefined) ??
        before.selection.filters.productCampaignId
      const productAdSetId = input.productAdSetId !== undefined
        ? input.productAdSetId as string
        : input.productCampaignId !== undefined
          ? 'all'
          : before.selection.filters.productAdSetId
      if (
        productCampaignId !== 'all' &&
        productAdSetId !== 'all' &&
        canonicalAdSetCampaign(productAdSetId) !== productCampaignId
      ) {
        return invalid(before, 'productAdSetId', 'Product Ad Set does not belong to the selected Product Campaign.')
      }

      const startDate = (input.startDate as string | undefined) ?? before.selection.startDate
      const endDate = (input.endDate as string | undefined) ?? before.selection.endDate
      if (!reportDates.has(startDate) || !reportDates.has(endDate)) {
        return invalid(before, 'dateRange', 'Dates must be inside the approved Aug 8–21 fixture window.')
      }
      if (startDate > endDate) {
        return invalid(before, 'dateRange', 'startDate must not be after endDate.')
      }
      const dateRangeChanged = input.startDate !== undefined || input.endDate !== undefined
      const currentFrame = before.animation.currentFrame < startDate || before.animation.currentFrame > endDate
        ? startDate
        : before.animation.currentFrame
      const patch: WorkspacePatch = {
        selection: {
          ...(input.productCampaignId !== undefined || input.productAdSetId !== undefined
            ? { filters: { productCampaignId, productAdSetId } }
            : {}),
          ...(dateRangeChanged ? { startDate, endDate } : {}),
        },
        analysis: { highlightMode: 'none' },
        ...(dateRangeChanged
          ? { animation: { currentFrame, playing: false } }
          : {}),
      }
      const filtersUnchanged =
        productCampaignId === before.selection.filters.productCampaignId &&
        productAdSetId === before.selection.filters.productAdSetId
      const datesUnchanged =
        startDate === before.selection.startDate && endDate === before.selection.endDate
      const animationUnchanged =
        !dateRangeChanged ||
        (currentFrame === before.animation.currentFrame && before.animation.playing === false)
      if (
        filtersUnchanged &&
        datesUnchanged &&
        animationUnchanged &&
        before.analysis.highlightMode === 'none'
      ) {
        return noOp(before, 'The requested filters are already active.')
      }
      return completeCapabilityMutation(
        capabilities,
        before,
        capabilities.configureView(patch, {
          actor: 'agent',
          activityKey: 'webmcpApplyFilters',
        })
      )
    },

    setAnimation(inputValue: unknown) {
      const before = capabilities.getState()
      const envelope = validateEnvelope(inputValue, before, [
        'mode', 'enabled', 'playing', 'currentFrame', 'expectedRevision',
      ])
      if (!envelope.ok) return envelope.result
      const input = envelope.input
      if (!['mode', 'enabled', 'playing', 'currentFrame'].some((key) => input[key] !== undefined)) {
        return invalid(before, 'input', 'At least one animation field is required.')
      }
      if (input.mode !== undefined && input.mode !== 'day_by_day' && input.mode !== 'off') {
        return invalid(before, 'mode', 'Animation mode must be day_by_day or off.')
      }
      if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
        return invalid(before, 'enabled', 'enabled must be boolean.')
      }
      if (input.playing !== undefined && typeof input.playing !== 'boolean') {
        return invalid(before, 'playing', 'playing must be boolean.')
      }
      if (
        input.currentFrame !== undefined &&
        (typeof input.currentFrame !== 'string' || !reportDates.has(input.currentFrame))
      ) {
        return invalid(before, 'currentFrame', 'currentFrame must be inside the approved fixture window.')
      }
      const currentFrame = (input.currentFrame as string | undefined) ?? before.animation.currentFrame
      if (currentFrame < before.selection.startDate || currentFrame > before.selection.endDate) {
        return invalid(before, 'currentFrame', 'currentFrame must be inside the selected date range.')
      }

      const animationPatch: Partial<WorkspaceState['animation']> = {
        ...(input.currentFrame !== undefined ? { currentFrame } : {}),
      }
      let analysisPatch: WorkspacePatch['analysis']
      let visualizationPatch: WorkspacePatch['visualization']
      if (input.mode === 'day_by_day') {
        animationPatch.enabled = true
        animationPatch.playing = input.playing === undefined ? true : input.playing as boolean
        analysisPatch = { comparisonDimension: 'time', highlightMode: 'none' }
        visualizationPatch = { chartType: 'line' }
      } else if (input.mode === 'off') {
        animationPatch.enabled = false
        animationPatch.playing = false
      } else {
        if (input.enabled !== undefined) animationPatch.enabled = input.enabled as boolean
        if (input.playing !== undefined) animationPatch.playing = input.playing as boolean
        const effectiveEnabled = animationPatch.enabled ?? before.animation.enabled
        const effectivePlaying = animationPatch.playing ?? before.animation.playing
        if (effectivePlaying && !effectiveEnabled) {
          return invalid(before, 'playing', 'Animation cannot play while disabled.')
        }
        if (animationPatch.enabled === false) animationPatch.playing = false
      }

      const patch: WorkspacePatch = {
        ...(analysisPatch ? { analysis: analysisPatch } : {}),
        ...(visualizationPatch ? { visualization: visualizationPatch } : {}),
        animation: animationPatch,
      }
      const animationAlreadyConfigured =
        (animationPatch.enabled === undefined ||
          animationPatch.enabled === before.animation.enabled) &&
        (animationPatch.playing === undefined ||
          animationPatch.playing === before.animation.playing) &&
        (animationPatch.currentFrame === undefined ||
          animationPatch.currentFrame === before.animation.currentFrame) &&
        (!analysisPatch ||
          analysisPatch.comparisonDimension === before.analysis.comparisonDimension) &&
        (!visualizationPatch ||
          visualizationPatch.chartType === before.visualization.chartType) &&
        (!analysisPatch || before.analysis.highlightMode === 'none')
      if (animationAlreadyConfigured) {
        return noOp(before, 'The requested animation configuration is already active.')
      }
      return completeCapabilityMutation(
        capabilities,
        before,
        capabilities.configureView(patch, {
          actor: 'agent',
          activityKey: 'webmcpSetAnimation',
        })
      )
    },

    resetView(inputValue: unknown) {
      const before = capabilities.getState()
      const envelope = validateEnvelope(inputValue, before, ['expectedRevision'])
      if (!envelope.ok) return envelope.result
      const defaultViewAlreadyActive =
        before.selection.filters.productCampaignId === 'all' &&
        before.selection.filters.productAdSetId === 'all' &&
        before.selection.startDate === dataset.window.startDate &&
        before.selection.endDate === dataset.window.endDate &&
        before.analysis.metric === 'impressions' &&
        before.analysis.demographicDimension === 'job_function' &&
        before.analysis.comparisonDimension === 'none' &&
        before.analysis.highlightMode === 'none' &&
        before.visualization.chartType === 'bar' &&
        before.animation.enabled === false &&
        before.animation.playing === false &&
        before.animation.currentFrame === dataset.window.startDate
      if (defaultViewAlreadyActive) {
        return noOp(before, 'The default analysis view is already active.')
      }
      const beforeDataset = readSnapshot().dataset
      capabilities.resetView({ actor: 'agent', activityKey: 'webmcpResetView' })
      const after = capabilities.getState()
      if (readSnapshot().dataset !== beforeDataset) {
        throw new Error('reset_view attempted to replace the loaded dataset.')
      }
      return success(before, after)
    },
  }
}
