import type {
  AdditiveMetrics,
  CoverageStatus,
  DemographicDimension,
  DemographicObservation,
} from '../dataset/types'

export type MetricKey =
  | 'impressions'
  | 'clicks'
  | 'spend'
  | 'conversions'
  | 'ctr'
  | 'cpm'
  | 'cpc'
  | 'cvr'
  | 'cpa'

export type ComparisonDimension =
  | 'none'
  | 'product_ad_set'
  | 'product_campaign'
  | 'time'

export type AnalysisFilters = {
  productCampaignId: string
  productAdSetId: string
}

export type AnalyticalQuery = {
  demographicDimensions: DemographicDimension[]
  comparisonDimension: ComparisonDimension
  metric: MetricKey
  filters: AnalysisFilters
  startDate: string
  endDate: string
  animationEnabled: boolean
  currentFrame: string
  ignoreAnimation?: boolean
}

export type AdditiveTotals = {
  metricObservationCount: number
  impressions: number
  clicks: number
  spend: number
  conversions: number
}

export type MetricUnavailableReason =
  | 'metric_not_supported'
  | 'no_metric_observations'
  | 'no_conversions_for_derived_metric'
  | 'no_clicks_for_derived_metric'
  | 'no_impressions_for_derived_metric'

export type MetricAvailability = {
  metric: MetricKey
  supported: boolean
  available: boolean
  unavailableReason: MetricUnavailableReason | null
}

export type AnalyticalCell = {
  demographicValue: string
  comparisonValue: string
  totals: AdditiveTotals
  metricAvailability: MetricAvailability
  value: number | null
}

export type QueryQualitySummary = {
  sourceType: 'daily_provisional_directional'
  privacyAdjusted: true
  metricObservationCount: number
  statusOnlyEvidenceCount: number
  unresolvedLabelCount: number
  coverageStatuses: CoverageStatus[]
}

export type UnsupportedIntersectionError = {
  ok: false
  error: {
    code: 'unsupported_demographic_intersection'
    message: string
    details: {
      requestedDemographicDimensions: DemographicDimension[]
      requiredCount: 1
    }
  }
}

export type AnalyticalQuerySuccess = {
  ok: true
  demographicDimension: DemographicDimension
  rows: DemographicObservation[]
  metricAvailability: MetricAvailability
  quality: QueryQualitySummary
  demographicValues: string[]
  comparisonValues: string[]
  cells: AnalyticalCell[]
  totals: AdditiveTotals
}

export type AnalyticalQueryResult = AnalyticalQuerySuccess | UnsupportedIntersectionError

export type MetricDefinition = {
  key: MetricKey
  label: string
  supported: true
  kind: 'raw' | 'derived'
  formula?: string
}

export type MetricObservation = DemographicObservation & AdditiveMetrics
