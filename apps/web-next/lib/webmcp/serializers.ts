import { calculateMetric, isMetricEligibleObservation, metricDefinitions } from '../analysis/metrics'
import { executeAnalyticalQuery } from '../analysis/query'
import type {
  AnalyticalQueryResult,
  AnalyticalQuerySuccess,
  MetricAvailability,
  MetricKey,
  QueryQualitySummary,
} from '../analysis/types'
import {
  assertPublicDemoComparisonValues,
  assertPublicDemoDataset,
  assertPublicDemoFilterValue,
  assertPublicDemoWorkspaceIdentities,
  PUBLIC_DEMO_CLIENT,
  PUBLIC_DEMO_PRODUCT_AD_SETS,
  PUBLIC_DEMO_PRODUCT_CAMPAIGNS,
} from '../dataset/public-demo-identities'
import { demographicDimensionDefinitions, type DemographicDataset } from '../dataset/types'
import { workspaceStateToQuery } from '../workspace/selectors'
import type { WorkspaceState } from '../workspace/types'

export const RESULT_SEGMENT_LIMIT = 5
export const COMPARISON_GROUP_LIMIT = 20
export const TOOL_RESULT_CHARACTER_LIMIT = 24_000

export type StudioWebMcpSnapshot = {
  dataset: DemographicDataset
  state: WorkspaceState
  result: AnalyticalQueryResult
}

const allowedComparisonDimensions = [
  'none',
  'product_ad_set',
  'product_campaign',
  'time',
] as const

function validateSnapshot(snapshot: StudioWebMcpSnapshot) {
  assertPublicDemoDataset(snapshot.dataset)
  assertPublicDemoWorkspaceIdentities(snapshot.state.dataset)
  assertPublicDemoFilterValue('productCampaignId', snapshot.state.selection.filters.productCampaignId)
  assertPublicDemoFilterValue('productAdSetId', snapshot.state.selection.filters.productAdSetId)
  if (
    snapshot.result.ok &&
    (snapshot.state.analysis.comparisonDimension === 'product_campaign' ||
      snapshot.state.analysis.comparisonDimension === 'product_ad_set')
  ) {
    assertPublicDemoComparisonValues(
      snapshot.state.analysis.comparisonDimension,
      snapshot.result.comparisonValues
    )
  }
}

function filterValue(
  state: WorkspaceState,
  kind: 'productCampaignId' | 'productAdSetId'
) {
  const id = state.selection.filters[kind]
  if (id === 'all') {
    return {
      id,
      label: kind === 'productCampaignId' ? 'All Product Campaigns' : 'All Product Ad Sets',
    }
  }
  const label = kind === 'productCampaignId'
    ? state.dataset.productCampaigns.find((campaign) => campaign.id === id)?.name
    : state.dataset.productAdSets.find((adSet) => adSet.id === id)?.name
  if (!label) throw new Error('Canonical workspace filter label is missing.')
  return { id, label }
}

function qualityWarnings(quality: QueryQualitySummary | null): string[] {
  const warnings = [
    'Daily provisional directional evidence is not an exact-window demographic total or deduplicated reach.',
    'LinkedIn privacy adjustments may suppress or revise demographic evidence.',
  ]
  if (!quality) return warnings
  if (quality.statusOnlyEvidenceCount > 0) {
    warnings.push(`${quality.statusOnlyEvidenceCount} status-only evidence records are excluded from metric totals.`)
  }
  if (quality.unresolvedLabelCount > 0) {
    warnings.push(`${quality.unresolvedLabelCount} evidence records retain unresolved demographic labels.`)
  }
  const incompleteStatuses = quality.coverageStatuses.filter((status) => status !== 'complete')
  if (incompleteStatuses.length) {
    warnings.push(`Selection includes coverage status: ${incompleteStatuses.join(', ')}.`)
  }
  return warnings.slice(0, 6)
}

function unavailableResult(metric: MetricKey): MetricAvailability {
  return {
    metric,
    supported: true,
    available: false,
    unavailableReason: 'no_metric_observations',
  }
}

function metricAvailabilityForCurrentSelection(
  dataset: DemographicDataset,
  state: WorkspaceState,
  metric: MetricKey
): MetricAvailability {
  const result = executeAnalyticalQuery(dataset, {
    ...workspaceStateToQuery(state, { ignoreAnimation: true }),
    metric,
  })
  return result.ok ? result.metricAvailability : unavailableResult(metric)
}

function serializeMetricAvailability(availability: MetricAvailability) {
  return {
    supported: availability.supported,
    available: availability.available,
    unavailableReason: availability.unavailableReason,
  }
}

function resultQuality(result: AnalyticalQueryResult) {
  return result.ok ? result.quality : null
}

export function assertBoundedSerializableOutput<T>(output: T): T {
  const serialized = JSON.stringify(output)
  if (serialized.length > TOOL_RESULT_CHARACTER_LIMIT) {
    throw new Error('WebMCP result exceeded the public bounded-output contract.')
  }
  const identityTokens = serialized.match(/\b(?:client|pc|pas)_[a-zA-Z0-9_-]+\b/g) ?? []
  const allowedIds = new Set<string>([
    PUBLIC_DEMO_CLIENT.id,
    ...PUBLIC_DEMO_PRODUCT_CAMPAIGNS.map((campaign) => campaign.id),
    ...PUBLIC_DEMO_PRODUCT_AD_SETS.map((adSet) => adSet.productAdSetId),
  ])
  if (identityTokens.some((token) => !allowedIds.has(token))) {
    throw new Error('WebMCP result contains a noncanonical public demo identity.')
  }
  if (/sponsoredCampaign/i.test(serialized) || /"rows"\s*:/.test(serialized)) {
    throw new Error('WebMCP result contains forbidden source-level data.')
  }
  return output
}

export function serializeMutationStateSummary(state: WorkspaceState) {
  assertPublicDemoWorkspaceIdentities(state.dataset)
  assertPublicDemoFilterValue('productCampaignId', state.selection.filters.productCampaignId)
  assertPublicDemoFilterValue('productAdSetId', state.selection.filters.productAdSetId)
  return {
    dataset: { id: state.dataset.datasetId, loaded: state.dataset.loaded },
    metric: state.analysis.metric,
    demographicDimension: state.analysis.demographicDimension,
    comparisonDimension: state.analysis.comparisonDimension,
    visualization: state.visualization.chartType,
    filters: {
      productCampaign: filterValue(state, 'productCampaignId'),
      productAdSet: filterValue(state, 'productAdSetId'),
      demographicValues: [],
    },
    dateRange: {
      startDate: state.selection.startDate,
      endDate: state.selection.endDate,
    },
    animation: { ...state.animation },
  }
}

export function serializeDatasetInspection(snapshot: StudioWebMcpSnapshot) {
  validateSnapshot(snapshot)
  const rows = snapshot.dataset.rows
  const metricObservationCount = rows.filter(isMetricEligibleObservation).length
  const statusOnlyEvidenceCount = rows.filter((row) => row.evidenceKind === 'status_only').length
  const unresolvedLabelCount = rows.filter((row) => row.pivotLabelStatus === 'unresolved').length
  const coverageStatuses = Array.from(new Set(rows.map((row) => row.coverageStatus))).sort()

  return assertBoundedSerializableOutput({
    dataset: {
      id: snapshot.dataset.datasetId,
      name: snapshot.dataset.name,
      provenance: snapshot.dataset.provenance,
      disclosure: snapshot.dataset.disclosure,
      client: { ...snapshot.dataset.client },
      dateRange: { ...snapshot.dataset.window },
      sourceSemantics: snapshot.dataset.sourceType,
      reportingLevel: snapshot.dataset.reportingLevel,
      privacyAdjusted: snapshot.dataset.privacyAdjusted,
    },
    identityCounts: {
      productCampaigns: snapshot.state.dataset.productCampaigns.length,
      productAdSets: snapshot.state.dataset.productAdSets.length,
    },
    demographicDimensions: demographicDimensionDefinitions.map(({ key, label }) => ({ key, label })),
    allowedComparisonDimensions: [...allowedComparisonDimensions],
    metrics: metricDefinitions.map((definition) => ({
      key: definition.key,
      label: definition.label,
      kind: definition.kind,
      supported: definition.supported,
      aggregateFormula: definition.formula ?? null,
      currentSelection: serializeMetricAvailability(
        metricAvailabilityForCurrentSelection(snapshot.dataset, snapshot.state, definition.key)
      ),
    })),
    constraints: {
      demographicIntersectionSupported: false,
      requiredDemographicDimensionCount: 1,
      errorCode: 'unsupported_demographic_intersection',
    },
    dataQuality: {
      metricObservationCount,
      statusOnlyEvidenceCount,
      unresolvedLabelCount,
      coverageStatuses,
      missingMetricsAreNotZero: snapshot.dataset.qualitySemantics.missingMetricsAreNotZero,
      warnings: qualityWarnings(resultQuality(snapshot.result)),
    },
  })
}

export function serializeWorkspaceState(snapshot: StudioWebMcpSnapshot) {
  validateSnapshot(snapshot)
  const state = snapshot.state
  const availability = snapshot.result.ok
    ? snapshot.result.metricAvailability
    : unavailableResult(state.analysis.metric)
  return assertBoundedSerializableOutput({
    workspaceRevision: state.runtime.revision,
    metric: state.analysis.metric,
    demographicDimension: state.analysis.demographicDimension,
    comparisonDimension: state.analysis.comparisonDimension,
    visualization: { chartType: state.visualization.chartType },
    filters: {
      productCampaign: filterValue(state, 'productCampaignId'),
      productAdSet: filterValue(state, 'productAdSetId'),
      demographicValues: [],
    },
    dateRange: {
      startDate: state.selection.startDate,
      endDate: state.selection.endDate,
    },
    animation: {
      enabled: state.animation.enabled,
      playing: state.animation.playing,
      currentFrame: state.animation.currentFrame,
    },
    metricAvailability: serializeMetricAvailability(availability),
    dataQualityWarnings: qualityWarnings(resultQuality(snapshot.result)),
  })
}

function segmentSortDescending(
  left: AnalyticalQuerySuccess['cells'][number],
  right: AnalyticalQuerySuccess['cells'][number]
) {
  return (
    (right.value ?? Number.NEGATIVE_INFINITY) - (left.value ?? Number.NEGATIVE_INFINITY) ||
    left.demographicValue.localeCompare(right.demographicValue) ||
    left.comparisonValue.localeCompare(right.comparisonValue)
  )
}

function serializeSegment(cell: AnalyticalQuerySuccess['cells'][number]) {
  return {
    demographicValue: cell.demographicValue,
    comparisonGroup: cell.comparisonValue,
    value: cell.value,
  }
}

export function serializeCurrentResultSummary(snapshot: StudioWebMcpSnapshot) {
  validateSnapshot(snapshot)
  const state = snapshot.state
  if (!snapshot.result.ok) {
    throw new Error(snapshot.result.error.code)
  }

  const result = snapshot.result
  const availableCells = result.cells
    .filter((cell) => cell.metricAvailability.available && cell.value !== null)
    .sort(segmentSortDescending)
  const topSegments = availableCells.slice(0, RESULT_SEGMENT_LIMIT).map(serializeSegment)
  const bottomSegments = [...availableCells]
    .sort((left, right) => -segmentSortDescending(left, right))
    .slice(0, RESULT_SEGMENT_LIMIT)
    .map(serializeSegment)
  const hasMetricEvidence = result.totals.metricObservationCount > 0
  const comparisonGroups = result.comparisonValues.slice(0, COMPARISON_GROUP_LIMIT)

  return assertBoundedSerializableOutput({
    metric: state.analysis.metric,
    demographicDimension: state.analysis.demographicDimension,
    comparisonDimension: state.analysis.comparisonDimension,
    filters: {
      productCampaign: filterValue(state, 'productCampaignId'),
      productAdSet: filterValue(state, 'productAdSetId'),
    },
    dateRange: {
      startDate: state.selection.startDate,
      endDate: state.selection.endDate,
    },
    currentTimeFrame: state.animation.enabled
      ? { mode: 'animation_frame', currentFrame: state.animation.currentFrame }
      : { mode: 'date_range', currentFrame: null },
    metricAvailability: serializeMetricAvailability(result.metricAvailability),
    totals: {
      metricObservationCount: result.totals.metricObservationCount,
      impressions: hasMetricEvidence ? result.totals.impressions : null,
      clicks: hasMetricEvidence ? result.totals.clicks : null,
      spend: hasMetricEvidence ? result.totals.spend : null,
      conversions: hasMetricEvidence ? result.totals.conversions : null,
      currentMetricValue: calculateMetric(result.totals, state.analysis.metric),
    },
    selectedComparisonGroups: comparisonGroups,
    comparisonGroupsTruncated: result.comparisonValues.length > comparisonGroups.length,
    topSegments,
    bottomSegments,
    evidence: {
      metricObservationCount: result.quality.metricObservationCount,
      statusOnlyEvidenceCount: result.quality.statusOnlyEvidenceCount,
      unresolvedLabelCount: result.quality.unresolvedLabelCount,
      coverageStatuses: result.quality.coverageStatuses,
    },
    dataQualityWarnings: qualityWarnings(result.quality),
  })
}
