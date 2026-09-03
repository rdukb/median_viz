import type { DemographicObservation } from '../dataset/types'
import type {
  AdditiveTotals,
  MetricAvailability,
  MetricDefinition,
  MetricKey,
} from './types'

export const metricDefinitions: MetricDefinition[] = [
  { key: 'impressions', label: 'Impressions', supported: true, kind: 'raw' },
  { key: 'clicks', label: 'Clicks', supported: true, kind: 'raw' },
  { key: 'spend', label: 'Spend', supported: true, kind: 'raw' },
  { key: 'conversions', label: 'Conversions', supported: true, kind: 'raw' },
  { key: 'ctr', label: 'CTR', supported: true, kind: 'derived', formula: 'sum(clicks) / sum(impressions)' },
  { key: 'cpm', label: 'CPM', supported: true, kind: 'derived', formula: 'sum(spend) * 1000 / sum(impressions)' },
  { key: 'cpc', label: 'CPC', supported: true, kind: 'derived', formula: 'sum(spend) / sum(clicks)' },
  { key: 'cvr', label: 'CVR', supported: true, kind: 'derived', formula: 'sum(conversions) / sum(clicks)' },
  { key: 'cpa', label: 'CPA', supported: true, kind: 'derived', formula: 'sum(spend) / sum(conversions)' },
]

export const metricLabel = (metric: MetricKey) =>
  metricDefinitions.find((definition) => definition.key === metric)?.label ?? metric

export const isMetricEligibleObservation = (row: DemographicObservation) =>
  row.evidenceKind === 'metric_observation' &&
  (row.coverageStatus === 'complete' || row.coverageStatus === 'partial')

export const sumAdditiveMetrics = (rows: DemographicObservation[]): AdditiveTotals =>
  rows.filter(isMetricEligibleObservation).reduce(
    (totals, row) => ({
      metricObservationCount: totals.metricObservationCount + 1,
      impressions: totals.impressions + (row.impressions ?? 0),
      clicks: totals.clicks + (row.clicks ?? 0),
      spend: totals.spend + (row.spend ?? 0),
      conversions: totals.conversions + (row.conversions ?? 0),
    }),
    { metricObservationCount: 0, impressions: 0, clicks: 0, spend: 0, conversions: 0 }
  )

export function getMetricAvailability(
  totals: AdditiveTotals,
  metric: MetricKey
): MetricAvailability {
  const supported = metricDefinitions.some(
    (definition) => definition.key === metric && definition.supported
  )
  if (!supported) {
    return { metric, supported: false, available: false, unavailableReason: 'metric_not_supported' }
  }
  if (totals.metricObservationCount === 0) {
    return { metric, supported: true, available: false, unavailableReason: 'no_metric_observations' }
  }
  if ((metric === 'cpa' || metric === 'cvr') && totals.conversions === 0) {
    return {
      metric,
      supported: true,
      available: false,
      unavailableReason: 'no_conversions_for_derived_metric',
    }
  }
  if ((metric === 'cpc' || metric === 'cvr') && totals.clicks === 0) {
    return {
      metric,
      supported: true,
      available: false,
      unavailableReason: 'no_clicks_for_derived_metric',
    }
  }
  if ((metric === 'ctr' || metric === 'cpm') && totals.impressions === 0) {
    return {
      metric,
      supported: true,
      available: false,
      unavailableReason: 'no_impressions_for_derived_metric',
    }
  }
  return { metric, supported: true, available: true, unavailableReason: null }
}

export function calculateMetric(totals: AdditiveTotals, metric: MetricKey): number | null {
  if (!getMetricAvailability(totals, metric).available) return null
  switch (metric) {
    case 'impressions': return totals.impressions
    case 'clicks': return totals.clicks
    case 'spend': return totals.spend
    case 'conversions': return totals.conversions
    case 'ctr': return (totals.clicks / totals.impressions) * 100
    case 'cpm': return (totals.spend * 1000) / totals.impressions
    case 'cpc': return totals.spend / totals.clicks
    case 'cvr': return (totals.conversions / totals.clicks) * 100
    case 'cpa': return totals.spend / totals.conversions
  }
}

export function formatMetric(value: number | null, metric: MetricKey, compact = false) {
  if (value === null) return 'Unavailable'
  if (metric === 'ctr' || metric === 'cvr') return `${value.toFixed(2)}%`
  if (metric === 'spend' || metric === 'cpm' || metric === 'cpc' || metric === 'cpa') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value)
}
