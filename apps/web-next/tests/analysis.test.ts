import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adaptLinkedInStagingExport,
  type LinkedInStagingExport,
  type LinkedInStagingExportRow,
} from '../lib/dataset/linkedin-staging-adapter'
import { executeAnalyticalQuery, cellValue } from '../lib/analysis/query'
import type { AnalyticalQuery, MetricKey } from '../lib/analysis/types'

const baseRow: LinkedInStagingExportRow = {
  reportDate: '2026-08-08',
  subjectKind: 'product_ad_set',
  productCampaignId: 'campaign-a',
  productCampaignName: 'Campaign A',
  productAdSetId: 'ad-set-a',
  productAdSetName: 'Ad Set A',
  linkedinSourceCampaignUrn: 'urn:li:sponsoredCampaign:1',
  pivotType: 'MEMBER_JOB_FUNCTION',
  pivotValue: 'urn:li:function:1',
  pivotLabel: 'Engineering',
  pivotLabelStatus: 'resolved',
  evidenceKind: 'metric_observation',
  coverageStatus: 'complete',
  privacyAdjusted: true,
  impressions: 10,
  clicks: 1,
  costInLocalCurrency: 10,
  externalWebsiteConversions: 1,
}

const row = (overrides: Partial<LinkedInStagingExportRow> = {}): LinkedInStagingExportRow => ({
  ...baseRow,
  ...overrides,
})

const dataset = (rows: LinkedInStagingExportRow[]) => adaptLinkedInStagingExport({
  datasetId: 'test-dataset',
  name: 'Test dataset',
  provenance: 'representative_demo',
  disclosure: 'Test representative dataset',
  client: { id: 'test-client', name: 'Test client' },
  sourceType: 'daily_provisional_directional',
  reportingLevel: 'CAMPAIGN',
  linkedinSourceEntityType: 'sponsoredCampaign',
  productSubjectType: 'product_ad_set',
  window: { startDate: '2026-08-08', endDate: '2026-08-21' },
  privacyAdjusted: true,
  qualitySemantics: {
    statusOnlyEvidencePreserved: true,
    unresolvedLabelsPreserved: true,
    missingMetricsAreNotZero: true,
    caveats: [],
  },
  rows,
} satisfies LinkedInStagingExport)

const query = (
  metric: MetricKey = 'impressions',
  overrides: Partial<AnalyticalQuery> = {}
): AnalyticalQuery => ({
  demographicDimensions: ['job_function'],
  comparisonDimension: 'none',
  metric,
  filters: { productCampaignId: 'all', productAdSetId: 'all' },
  startDate: '2026-08-08',
  endDate: '2026-08-21',
  animationEnabled: false,
  currentFrame: '2026-08-08',
  ...overrides,
})

test('exactly one demographic pivot is required', () => {
  const result = executeAnalyticalQuery(dataset([baseRow]), query('impressions', {
    demographicDimensions: [],
  }))
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'unsupported_demographic_intersection')
})

test('cross-demographic requests return the frozen structured error', () => {
  const result = executeAnalyticalQuery(dataset([baseRow]), query('impressions', {
    demographicDimensions: ['job_function', 'seniority'],
  }))
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'unsupported_demographic_intersection',
      message: 'LinkedIn demographic pivots are independent. An analytical query must select exactly one demographic dimension.',
      details: {
        requestedDemographicDimensions: ['job_function', 'seniority'],
        requiredCount: 1,
      },
    },
  })
})

test('CTR uses aggregate clicks divided by aggregate impressions', () => {
  const result = executeAnalyticalQuery(dataset([
    row({ impressions: 1, clicks: 1 }),
    row({ impressions: 99, clicks: 9, pivotValue: 'urn:li:function:2' }),
  ]), query('ctr'))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.cells[0].value, 10)
})

test('CPC uses aggregate spend divided by aggregate clicks', () => {
  const result = executeAnalyticalQuery(dataset([
    row({ clicks: 1, costInLocalCurrency: 10 }),
    row({ clicks: 99, costInLocalCurrency: 90, pivotValue: 'urn:li:function:2' }),
  ]), query('cpc'))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.cells[0].value, 1)
})

test('zero conversions makes CPA and CVR supported but unavailable', () => {
  const source = dataset([row({ clicks: 10, externalWebsiteConversions: 0 })])
  for (const metric of ['cpa', 'cvr'] as const) {
    const result = executeAnalyticalQuery(source, query(metric))
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.deepEqual(result.metricAvailability, {
        metric,
        supported: true,
        available: false,
        unavailableReason: 'no_conversions_for_derived_metric',
      })
      assert.equal(result.cells[0].value, null)
    }
  }
})

test('status-only evidence stays null and does not become zero', () => {
  const result = executeAnalyticalQuery(dataset([row({
    pivotValue: null,
    pivotLabel: null,
    pivotLabelStatus: 'not_applicable',
    evidenceKind: 'status_only',
    coverageStatus: 'empty_observed',
    impressions: null,
    clicks: null,
    costInLocalCurrency: null,
    externalWebsiteConversions: null,
  })]), query('impressions'))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.metricAvailability.available, false)
    assert.equal(result.metricAvailability.unavailableReason, 'no_metric_observations')
    assert.equal(result.quality.statusOnlyEvidenceCount, 1)
    assert.equal(result.cells.length, 0)
  }
})

test('different demographic pivot types are never summed together', () => {
  const result = executeAnalyticalQuery(dataset([
    row({ impressions: 10 }),
    row({
      pivotType: 'MEMBER_SENIORITY',
      pivotValue: 'urn:li:seniority:1',
      pivotLabel: 'CXO',
      impressions: 999,
    }),
  ]), query('impressions'))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.totals.impressions, 10)
})

test('Product Campaign filtering is canonical and scoped', () => {
  const result = executeAnalyticalQuery(dataset([
    row({ impressions: 10 }),
    row({
      productCampaignId: 'campaign-b',
      productCampaignName: 'Campaign B',
      productAdSetId: 'ad-set-b',
      productAdSetName: 'Ad Set B',
      impressions: 90,
    }),
  ]), query('impressions', {
    filters: { productCampaignId: 'campaign-b', productAdSetId: 'all' },
  }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.totals.impressions, 90)
})

test('Product Ad Set filtering is canonical and scoped', () => {
  const result = executeAnalyticalQuery(dataset([
    row({ impressions: 10 }),
    row({
      productAdSetId: 'ad-set-b',
      productAdSetName: 'Ad Set B',
      impressions: 90,
    }),
  ]), query('impressions', {
    filters: { productCampaignId: 'all', productAdSetId: 'ad-set-a' },
  }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.totals.impressions, 10)
})

test('time comparison preserves ordered daily series', () => {
  const result = executeAnalyticalQuery(dataset([
    row({ reportDate: '2026-08-10', impressions: 30 }),
    row({ reportDate: '2026-08-08', impressions: 10 }),
    row({ reportDate: '2026-08-09', impressions: 20 }),
  ]), query('impressions', { comparisonDimension: 'time' }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.comparisonValues, [
      '2026-08-08',
      '2026-08-09',
      '2026-08-10',
    ])
    assert.deepEqual(
      result.comparisonValues.map((date) =>
        cellValue(result.cells, 'Engineering', date)
      ),
      [10, 20, 30]
    )
  }
})

test('fixture adapter maps source pivot and metric names into canonical fields', () => {
  const adapted = dataset([row({
    pivotType: 'MEMBER_COMPANY_SIZE',
    costInLocalCurrency: 12.5,
    externalWebsiteConversions: 3,
  })])
  assert.equal(adapted.rows[0].demographicDimension, 'company_size')
  assert.equal(adapted.rows[0].sourcePivotType, 'MEMBER_COMPANY_SIZE')
  assert.equal(adapted.rows[0].spend, 12.5)
  assert.equal(adapted.rows[0].conversions, 3)
})
