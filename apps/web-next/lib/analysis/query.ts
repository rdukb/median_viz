import type { DemographicDataset, DemographicObservation } from '../dataset/types'
import {
  calculateMetric,
  getMetricAvailability,
  isMetricEligibleObservation,
  sumAdditiveMetrics,
} from './metrics'
import type {
  AnalyticalCell,
  AnalyticalQuery,
  AnalyticalQueryResult,
  ComparisonDimension,
} from './types'

export const pivotDisplayLabel = (row: DemographicObservation) =>
  row.pivotLabel ??
  (row.pivotValue ? `Unresolved · ${row.pivotValue.split(':').at(-1)}` : 'Status only')

export const comparisonValue = (
  row: DemographicObservation,
  comparison: ComparisonDimension
) => {
  switch (comparison) {
    case 'product_ad_set': return row.productAdSetName
    case 'product_campaign': return row.productCampaignName
    case 'time': return row.reportDate
    case 'none': return 'All selected delivery'
  }
}

const orderedUnique = (values: string[]) => Array.from(new Set(values))

function buildCells(
  rows: DemographicObservation[],
  query: AnalyticalQuery,
  demographicValues: string[],
  comparisonValues: string[]
): AnalyticalCell[] {
  return comparisonValues.flatMap((comparison) =>
    demographicValues.map((demographicValue) => {
      const cellRows = rows.filter(
        (row) =>
          isMetricEligibleObservation(row) &&
          pivotDisplayLabel(row) === demographicValue &&
          comparisonValue(row, query.comparisonDimension) === comparison
      )
      const totals = sumAdditiveMetrics(cellRows)
      return {
        demographicValue,
        comparisonValue: comparison,
        totals,
        metricAvailability: getMetricAvailability(totals, query.metric),
        value: calculateMetric(totals, query.metric),
      }
    })
  )
}

export function executeAnalyticalQuery(
  dataset: DemographicDataset,
  query: AnalyticalQuery
): AnalyticalQueryResult {
  if (query.demographicDimensions.length !== 1) {
    return {
      ok: false,
      error: {
        code: 'unsupported_demographic_intersection',
        message:
          'LinkedIn demographic pivots are independent. An analytical query must select exactly one demographic dimension.',
        details: {
          requestedDemographicDimensions: query.demographicDimensions,
          requiredCount: 1,
        },
      },
    }
  }

  const demographicDimension = query.demographicDimensions[0]
  const shouldFilterAnimation =
    query.animationEnabled &&
    query.comparisonDimension !== 'time' &&
    !query.ignoreAnimation

  const rows = dataset.rows.filter((row) =>
    row.demographicDimension === demographicDimension &&
    row.reportDate >= query.startDate &&
    row.reportDate <= query.endDate &&
    (!shouldFilterAnimation || row.reportDate === query.currentFrame) &&
    (query.filters.productCampaignId === 'all' ||
      row.productCampaignId === query.filters.productCampaignId) &&
    (query.filters.productAdSetId === 'all' ||
      row.productAdSetId === query.filters.productAdSetId)
  )

  const metricRows = rows.filter(isMetricEligibleObservation)
  const totals = sumAdditiveMetrics(metricRows)
  const demographicValues = orderedUnique(metricRows.map(pivotDisplayLabel)).sort()
  const comparisonValues = query.comparisonDimension === 'time'
    ? orderedUnique(metricRows.map((row) => row.reportDate)).sort()
    : query.comparisonDimension === 'none'
      ? ['All selected delivery']
      : orderedUnique(metricRows.map((row) => comparisonValue(row, query.comparisonDimension))).sort()

  return {
    ok: true,
    demographicDimension,
    rows,
    totals,
    metricAvailability: getMetricAvailability(totals, query.metric),
    quality: {
      sourceType: dataset.sourceType,
      privacyAdjusted: dataset.privacyAdjusted,
      metricObservationCount: metricRows.length,
      statusOnlyEvidenceCount: rows.length - metricRows.length,
      unresolvedLabelCount: metricRows.filter((row) => row.pivotLabelStatus === 'unresolved').length,
      coverageStatuses: orderedUnique(rows.map((row) => row.coverageStatus)).sort() as typeof rows[number]['coverageStatus'][],
    },
    demographicValues,
    comparisonValues,
    cells: buildCells(metricRows, query, demographicValues, comparisonValues),
  }
}

export const cellValue = (
  cells: AnalyticalCell[],
  demographicValue: string,
  comparison: string
) => cells.find(
  (cell) =>
    cell.demographicValue === demographicValue &&
    cell.comparisonValue === comparison
)?.value ?? null
