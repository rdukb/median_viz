import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adaptCsvFixture,
  parsePublicFixtureMetadata,
  PUBLIC_FIXTURE_SCHEMA_VERSION,
  type PublicFixtureMetadata,
} from '../lib/dataset/csv-fixture-adapter'
import { demographicDimensionDefinitions } from '../lib/dataset/types'
import {
  PUBLIC_DEMO_CLIENT,
  PUBLIC_DEMO_DATASET,
} from '../lib/dataset/public-demo-identities'

const metadata: PublicFixtureMetadata = {
  schemaVersion: PUBLIC_FIXTURE_SCHEMA_VERSION,
  datasetId: PUBLIC_DEMO_DATASET.id,
  name: PUBLIC_DEMO_DATASET.name,
  provenance: PUBLIC_DEMO_DATASET.provenance,
  disclosure: PUBLIC_DEMO_DATASET.disclosure,
  client: PUBLIC_DEMO_CLIENT,
  sourceType: 'daily_provisional_directional',
  reportingLevel: 'CAMPAIGN',
  linkedinSourceEntityType: 'sponsoredCampaign',
  productSubjectType: 'product_ad_set',
  window: { startDate: '2026-08-08', endDate: '2026-08-21' },
  privacyAdjusted: true,
  latestImportedRevisionOnly: true,
  anonymization: {
    appliedBeforeRepositoryWrite: true,
    policy: 'deterministic-demo-identities-v1',
  },
  expectedProductCampaignCount: 2,
  expectedProductAdSetCount: 3,
  supportedPivotTypes: demographicDimensionDefinitions.map(
    (dimension) => dimension.sourcePivotType
  ),
  qualitySemantics: {
    statusOnlyEvidencePreserved: true,
    unresolvedLabelsPreserved: true,
    missingMetricsAreNotZero: true,
    caveats: ['Directional fixture'],
  },
}

const header = [
  'report_date',
  'subject_kind',
  'product_campaign_id',
  'product_campaign_name',
  'product_ad_set_id',
  'product_ad_set_name',
  'linkedin_source_campaign_urn',
  'pivot_type',
  'pivot_value',
  'pivot_label',
  'pivot_label_status',
  'evidence_kind',
  'coverage_status',
  'privacy_adjusted',
  'impressions',
  'clicks',
  'cost_in_local_currency',
  'external_website_conversions',
].join(',')

const rows = [
  [
    '2026-08-08', 'product_ad_set',
    'pc_demo_001', 'Growth Leaders',
    'pas_demo_001', 'Innovation Buyers',
    'urn:linkedin-demo:sponsoredCampaign:lsc_demo_001',
    'MEMBER_JOB_FUNCTION', 'urn:li:function:8', 'Information Technology',
    'resolved', 'metric_observation', 'complete', 'true', '100', '10', '25.50', '0',
  ].join(','),
  [
    '2026-08-09', 'product_ad_set',
    'pc_demo_001', 'Growth Leaders',
    'pas_demo_002', 'Revenue Leaders',
    'urn:linkedin-demo:sponsoredCampaign:lsc_demo_002',
    'MEMBER_INDUSTRY', 'urn:li:industry:96', '',
    'unresolved', 'metric_observation', 'partial', 'true', '80', '4', '12.00', '0',
  ].join(','),
  [
    '2026-08-10', 'product_ad_set',
    'pc_demo_002', 'Executive Reach',
    'pas_demo_003', 'Operations Decision Makers',
    'urn:linkedin-demo:sponsoredCampaign:lsc_demo_003',
    'MEMBER_COUNTY', '', '',
    'not_applicable', 'status_only', 'empty_observed', 'true', '', '', '', '',
  ].join(','),
]

const csv = [header, ...rows].join('\n')

test('metadata parser preserves the approved public fixture contract', () => {
  const parsed = parsePublicFixtureMetadata(JSON.stringify(metadata))
  assert.equal(parsed.client.name, 'Northstar Media')
  assert.equal(parsed.provenance, 'representative_demo')
  assert.equal(parsed.latestImportedRevisionOnly, true)
  assert.equal(parsed.supportedPivotTypes.length, 9)
  assert.equal(parsed.privacyAdjusted, true)
})

test('CSV adapter maps export columns into the canonical dataset', () => {
  const dataset = adaptCsvFixture(csv, metadata)
  assert.equal(dataset.rows.length, 3)
  assert.equal(dataset.rows[0].demographicDimension, 'job_function')
  assert.equal(dataset.rows[0].spend, 25.5)
  assert.equal(dataset.rows[0].conversions, 0)
  assert.equal(dataset.rows[0].productCampaignName, 'Growth Leaders')
  assert.equal(dataset.rows[0].productAdSetName, 'Innovation Buyers')
})

test('CSV adapter preserves unresolved labels', () => {
  const dataset = adaptCsvFixture(csv, metadata)
  const unresolved = dataset.rows[1]
  assert.equal(unresolved.demographicDimension, 'industry')
  assert.equal(unresolved.pivotLabel, null)
  assert.equal(unresolved.pivotLabelStatus, 'unresolved')
  assert.equal(unresolved.pivotValue, 'urn:li:industry:96')
})

test('CSV adapter preserves status-only rows and nullable metrics', () => {
  const dataset = adaptCsvFixture(csv, metadata)
  const statusOnly = dataset.rows[2]
  assert.equal(statusOnly.evidenceKind, 'status_only')
  assert.equal(statusOnly.coverageStatus, 'empty_observed')
  assert.equal(statusOnly.impressions, null)
  assert.equal(statusOnly.clicks, null)
  assert.equal(statusOnly.spend, null)
  assert.equal(statusOnly.conversions, null)
})

test('CSV adapter rejects non-demo identities before canonicalization', () => {
  const unsafe = csv.replace('pc_demo_001', 'campaign_not_demo_safe')
  assert.throws(() => adaptCsvFixture(unsafe, metadata), /Non-demo identity rejected/)
})
