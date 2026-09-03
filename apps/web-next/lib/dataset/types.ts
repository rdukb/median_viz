export type DemographicDimension =
  | 'company'
  | 'company_size'
  | 'country'
  | 'county'
  | 'industry'
  | 'job_function'
  | 'job_title'
  | 'region'
  | 'seniority'

export type LinkedInPivotType =
  | 'MEMBER_COMPANY'
  | 'MEMBER_COMPANY_SIZE'
  | 'MEMBER_COUNTRY_V2'
  | 'MEMBER_COUNTY'
  | 'MEMBER_INDUSTRY'
  | 'MEMBER_JOB_FUNCTION'
  | 'MEMBER_JOB_TITLE'
  | 'MEMBER_REGION_V2'
  | 'MEMBER_SENIORITY'

export type EvidenceKind = 'metric_observation' | 'status_only'
export type CoverageStatus =
  | 'complete'
  | 'empty_observed'
  | 'partial'
  | 'rejected'
  | 'not_attempted'
export type PivotLabelStatus = 'resolved' | 'unresolved' | 'not_applicable'

export type AdditiveMetrics = {
  impressions: number | null
  clicks: number | null
  spend: number | null
  conversions: number | null
}

export type DemographicObservation = AdditiveMetrics & {
  reportDate: string
  subjectKind: 'product_ad_set'
  productCampaignId: string
  productCampaignName: string
  productAdSetId: string
  productAdSetName: string
  linkedinSourceCampaignUrn: string
  demographicDimension: DemographicDimension
  sourcePivotType: LinkedInPivotType
  pivotValue: string | null
  pivotLabel: string | null
  pivotLabelStatus: PivotLabelStatus
  evidenceKind: EvidenceKind
  coverageStatus: CoverageStatus
  privacyAdjusted: true
}

export type DatasetQualitySemantics = {
  statusOnlyEvidencePreserved: true
  unresolvedLabelsPreserved: true
  missingMetricsAreNotZero: true
  caveats: string[]
}

export type DatasetProvenance =
  | 'representative_demo'
  | 'anonymized_historical_sample'

export type DemographicDataset = {
  datasetId: string
  name: string
  provenance: DatasetProvenance
  disclosure: string
  client: { id: string; name: string }
  sourceType: 'daily_provisional_directional'
  reportingLevel: 'CAMPAIGN'
  linkedinSourceEntityType: 'sponsoredCampaign'
  productSubjectType: 'product_ad_set'
  window: { startDate: string; endDate: string }
  privacyAdjusted: true
  qualitySemantics: DatasetQualitySemantics
  rows: DemographicObservation[]
}

export type DemographicDimensionDefinition = {
  key: DemographicDimension
  label: string
  sourcePivotType: LinkedInPivotType
}

export const demographicDimensionDefinitions: DemographicDimensionDefinition[] = [
  { key: 'job_function', label: 'Job function', sourcePivotType: 'MEMBER_JOB_FUNCTION' },
  { key: 'seniority', label: 'Seniority', sourcePivotType: 'MEMBER_SENIORITY' },
  { key: 'job_title', label: 'Job title', sourcePivotType: 'MEMBER_JOB_TITLE' },
  { key: 'company', label: 'Company', sourcePivotType: 'MEMBER_COMPANY' },
  { key: 'company_size', label: 'Company size', sourcePivotType: 'MEMBER_COMPANY_SIZE' },
  { key: 'industry', label: 'Industry', sourcePivotType: 'MEMBER_INDUSTRY' },
  { key: 'country', label: 'Country', sourcePivotType: 'MEMBER_COUNTRY_V2' },
  { key: 'region', label: 'Region', sourcePivotType: 'MEMBER_REGION_V2' },
  { key: 'county', label: 'County', sourcePivotType: 'MEMBER_COUNTY' },
]

export const sourcePivotToDimension = Object.fromEntries(
  demographicDimensionDefinitions.map((definition) => [
    definition.sourcePivotType,
    definition.key,
  ])
) as Record<LinkedInPivotType, DemographicDimension>

export const demographicDimensionLabel = (dimension: DemographicDimension) =>
  demographicDimensionDefinitions.find((definition) => definition.key === dimension)?.label ?? dimension
