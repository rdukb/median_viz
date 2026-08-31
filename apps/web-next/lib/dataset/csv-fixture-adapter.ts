import Papa from 'papaparse'
import { adaptLinkedInStagingExport, DatasetAdapterError, type LinkedInStagingExport } from './linkedin-staging-adapter'
import {
  assertPublicDemoDataset,
  assertPublicDemoIdentityRow,
  PUBLIC_DEMO_CLIENT,
  PUBLIC_DEMO_DATASET,
} from './public-demo-identities'
import {
  demographicDimensionDefinitions,
  type CoverageStatus,
  type EvidenceKind,
  type LinkedInPivotType,
  type PivotLabelStatus,
} from './types'

export const PUBLIC_FIXTURE_SCHEMA_VERSION = 'median-viz.adset-demographics-export.v1'

export const CSV_FIXTURE_COLUMNS = [
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
] as const

export type PublicFixtureMetadata = Omit<LinkedInStagingExport, 'rows'> & {
  schemaVersion: typeof PUBLIC_FIXTURE_SCHEMA_VERSION
  datasetId: typeof PUBLIC_DEMO_DATASET.id
  name: typeof PUBLIC_DEMO_DATASET.name
  provenance: typeof PUBLIC_DEMO_DATASET.provenance
  disclosure: typeof PUBLIC_DEMO_DATASET.disclosure
  client: typeof PUBLIC_DEMO_CLIENT
  latestImportedRevisionOnly: true
  anonymization: {
    appliedBeforeRepositoryWrite: true
    policy: 'deterministic-demo-identities-v1'
  }
  expectedProductCampaignCount: 2
  expectedProductAdSetCount: 3
  supportedPivotTypes: LinkedInPivotType[]
}

type CsvRecord = Record<(typeof CSV_FIXTURE_COLUMNS)[number], string>

const coverageStatuses = new Set<CoverageStatus>([
  'complete',
  'empty_observed',
  'partial',
  'rejected',
  'not_attempted',
])
const evidenceKinds = new Set<EvidenceKind>(['metric_observation', 'status_only'])
const labelStatuses = new Set<PivotLabelStatus>(['resolved', 'unresolved', 'not_applicable'])
const pivotTypes = new Set<LinkedInPivotType>(
  demographicDimensionDefinitions.map((dimension) => dimension.sourcePivotType)
)
const nullable = (value: string) => value.trim() === '' ? null : value
const nullableNumber = (value: string, field: string) => {
  if (value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new DatasetAdapterError(`Invalid numeric ${field}.`)
  return parsed
}

export function parsePublicFixtureMetadata(input: string | unknown): PublicFixtureMetadata {
  const value = typeof input === 'string' ? JSON.parse(input) : input
  if (!value || typeof value !== 'object') {
    throw new DatasetAdapterError('Fixture metadata must be an object.')
  }
  const metadata = value as PublicFixtureMetadata
  if (metadata.schemaVersion !== PUBLIC_FIXTURE_SCHEMA_VERSION) {
    throw new DatasetAdapterError('Unsupported fixture metadata schema version.')
  }
  if (
    metadata.datasetId !== PUBLIC_DEMO_DATASET.id ||
    metadata.name !== PUBLIC_DEMO_DATASET.name ||
    metadata.provenance !== PUBLIC_DEMO_DATASET.provenance ||
    metadata.disclosure !== PUBLIC_DEMO_DATASET.disclosure ||
    metadata.client?.id !== PUBLIC_DEMO_CLIENT.id ||
    metadata.client?.name !== PUBLIC_DEMO_CLIENT.name
  ) {
    throw new DatasetAdapterError('Public fixture client identity is not demo-safe.')
  }
  if (!metadata.latestImportedRevisionOnly) {
    throw new DatasetAdapterError('Fixture must contain latest imported revisions only.')
  }
  if (
    metadata.anonymization?.appliedBeforeRepositoryWrite !== true ||
    metadata.anonymization?.policy !== 'deterministic-demo-identities-v1'
  ) {
    throw new DatasetAdapterError('Fixture anonymization contract is missing.')
  }
  if (
    metadata.expectedProductCampaignCount !== 2 ||
    metadata.expectedProductAdSetCount !== 3
  ) {
    throw new DatasetAdapterError('Fixture identity cardinality is outside the approved demo scope.')
  }
  if (
    !Array.isArray(metadata.supportedPivotTypes) ||
    metadata.supportedPivotTypes.length !== pivotTypes.size ||
    metadata.supportedPivotTypes.some((pivot) => !pivotTypes.has(pivot))
  ) {
    throw new DatasetAdapterError('Fixture must declare all nine supported pivots.')
  }
  return metadata
}

export function adaptCsvFixture(
  csvText: string,
  metadataInput: string | unknown
) {
  const metadata = parsePublicFixtureMetadata(metadataInput)
  const parsed = Papa.parse<CsvRecord>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })
  if (parsed.errors.length) {
    throw new DatasetAdapterError(`CSV parse failed at row ${parsed.errors[0].row ?? 'unknown'}.`)
  }
  const fields = parsed.meta.fields ?? []
  if (
    fields.length !== CSV_FIXTURE_COLUMNS.length ||
    CSV_FIXTURE_COLUMNS.some((field) => !fields.includes(field))
  ) {
    throw new DatasetAdapterError('CSV columns do not match the approved export schema.')
  }

  const rows: LinkedInStagingExport['rows'] = parsed.data.map((record, index) => {
    const pivotType = record.pivot_type as LinkedInPivotType
    const coverageStatus = record.coverage_status as CoverageStatus
    const evidenceKind = record.evidence_kind as EvidenceKind
    const pivotLabelStatus = record.pivot_label_status as PivotLabelStatus
    if (!pivotTypes.has(pivotType)) throw new DatasetAdapterError(`Unsupported pivot at CSV row ${index + 2}.`)
    if (!coverageStatuses.has(coverageStatus)) throw new DatasetAdapterError(`Unsupported coverage status at CSV row ${index + 2}.`)
    if (!evidenceKinds.has(evidenceKind)) throw new DatasetAdapterError(`Unsupported evidence kind at CSV row ${index + 2}.`)
    if (!labelStatuses.has(pivotLabelStatus)) throw new DatasetAdapterError(`Unsupported label status at CSV row ${index + 2}.`)
    if (record.subject_kind !== 'product_ad_set') throw new DatasetAdapterError(`Invalid subject kind at CSV row ${index + 2}.`)
    if (record.privacy_adjusted !== 'true') throw new DatasetAdapterError(`Privacy adjustment must remain explicit at CSV row ${index + 2}.`)
    try {
      assertPublicDemoIdentityRow({
        productCampaignId: record.product_campaign_id,
        productCampaignName: record.product_campaign_name,
        productAdSetId: record.product_ad_set_id,
        productAdSetName: record.product_ad_set_name,
        linkedinSourceCampaignUrn: record.linkedin_source_campaign_urn,
      })
    } catch {
      throw new DatasetAdapterError(`Non-demo identity rejected at CSV row ${index + 2}.`)
    }

    const metricValues = {
      impressions: nullableNumber(record.impressions, 'impressions'),
      clicks: nullableNumber(record.clicks, 'clicks'),
      costInLocalCurrency: nullableNumber(record.cost_in_local_currency, 'cost_in_local_currency'),
      externalWebsiteConversions: nullableNumber(
        record.external_website_conversions,
        'external_website_conversions'
      ),
    }
    if (
      evidenceKind === 'status_only' &&
      Object.values(metricValues).some((value) => value !== null)
    ) {
      throw new DatasetAdapterError(`Status-only metrics must remain null at CSV row ${index + 2}.`)
    }

    return {
      reportDate: record.report_date,
      subjectKind: 'product_ad_set',
      productCampaignId: record.product_campaign_id,
      productCampaignName: record.product_campaign_name,
      productAdSetId: record.product_ad_set_id,
      productAdSetName: record.product_ad_set_name,
      linkedinSourceCampaignUrn: record.linkedin_source_campaign_urn,
      pivotType,
      pivotValue: nullable(record.pivot_value),
      pivotLabel: nullable(record.pivot_label),
      pivotLabelStatus,
      evidenceKind,
      coverageStatus,
      privacyAdjusted: true,
      ...metricValues,
    }
  })

  const campaignCount = new Set(rows.map((row) => row.productCampaignId)).size
  const adSetCount = new Set(rows.map((row) => row.productAdSetId)).size
  if (
    campaignCount !== metadata.expectedProductCampaignCount ||
    adSetCount !== metadata.expectedProductAdSetCount
  ) {
    throw new DatasetAdapterError('CSV identity cardinality does not match metadata.')
  }

  const dataset = adaptLinkedInStagingExport({
    datasetId: metadata.datasetId,
    name: metadata.name,
    provenance: metadata.provenance,
    disclosure: metadata.disclosure,
    client: metadata.client,
    sourceType: metadata.sourceType,
    reportingLevel: metadata.reportingLevel,
    linkedinSourceEntityType: metadata.linkedinSourceEntityType,
    productSubjectType: metadata.productSubjectType,
    window: metadata.window,
    privacyAdjusted: metadata.privacyAdjusted,
    qualitySemantics: metadata.qualitySemantics,
    rows,
  })
  assertPublicDemoDataset(dataset)
  return dataset
}
