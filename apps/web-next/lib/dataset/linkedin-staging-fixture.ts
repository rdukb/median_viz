import { adaptLinkedInStagingExport, type LinkedInStagingExport } from './linkedin-staging-adapter'
import {
  assertPublicDemoDataset,
  PUBLIC_DEMO_CLIENT,
  PUBLIC_DEMO_DATASET,
  PUBLIC_DEMO_PRODUCT_AD_SETS,
} from './public-demo-identities'
import {
  demographicDimensionDefinitions,
  type LinkedInPivotType,
} from './types'

export const reportDates = Array.from({ length: 14 }, (_, index) =>
  `2026-08-${String(8 + index).padStart(2, '0')}`
)

export const fixtureProductAdSets = PUBLIC_DEMO_PRODUCT_AD_SETS

const pivotValues: Record<LinkedInPivotType, Array<{ value: string; label: string }>> = {
  MEMBER_JOB_FUNCTION: [
    { value: 'urn:li:function:8', label: 'Information Technology' },
    { value: 'urn:li:function:13', label: 'Engineering' },
    { value: 'urn:li:function:18', label: 'Operations' },
    { value: 'urn:li:function:4', label: 'Business Development' },
  ],
  MEMBER_SENIORITY: [
    { value: 'urn:li:seniority:5', label: 'Manager' },
    { value: 'urn:li:seniority:4', label: 'Director' },
    { value: 'urn:li:seniority:3', label: 'VP' },
    { value: 'urn:li:seniority:1', label: 'CXO' },
  ],
  MEMBER_JOB_TITLE: [
    { value: 'urn:li:title:9101', label: 'Head of Data' },
    { value: 'urn:li:title:9102', label: 'VP of Engineering' },
    { value: 'urn:li:title:9103', label: 'Chief Information Officer' },
    { value: 'urn:li:title:9104', label: 'Director of Operations' },
  ],
  MEMBER_COMPANY: [
    { value: 'urn:li:organization:81001', label: 'Northstar Systems' },
    { value: 'urn:li:organization:81002', label: 'Vertex Labs' },
    { value: 'urn:li:organization:81003', label: 'Meridian Group' },
    { value: 'urn:li:organization:81004', label: 'Harbor Technologies' },
  ],
  MEMBER_COMPANY_SIZE: [
    { value: 'SIZE_201_TO_500', label: '201–500 employees' },
    { value: 'SIZE_501_TO_1000', label: '501–1,000 employees' },
    { value: 'SIZE_1001_TO_5000', label: '1,001–5,000 employees' },
    { value: 'SIZE_5001_TO_10000', label: '5,001–10,000 employees' },
  ],
  MEMBER_INDUSTRY: [
    { value: 'urn:li:industry:4', label: 'Software Development' },
    { value: 'urn:li:industry:96', label: 'IT Services and Consulting' },
    { value: 'urn:li:industry:43', label: 'Financial Services' },
    { value: 'urn:li:industry:6', label: 'Internet' },
  ],
  MEMBER_COUNTRY_V2: [
    { value: 'urn:li:geo:103644278', label: 'United States' },
    { value: 'urn:li:geo:101174742', label: 'Canada' },
    { value: 'urn:li:geo:101165590', label: 'United Kingdom' },
    { value: 'urn:li:geo:101282230', label: 'Germany' },
  ],
  MEMBER_REGION_V2: [
    { value: 'urn:li:geo:90000084', label: 'San Francisco Bay Area' },
    { value: 'urn:li:geo:90000070', label: 'New York City Metropolitan Area' },
    { value: 'urn:li:geo:90000007', label: 'Greater Boston' },
    { value: 'urn:li:geo:90000064', label: 'Austin, Texas Metropolitan Area' },
  ],
  MEMBER_COUNTY: [
    { value: 'urn:li:geo:91000001', label: 'San Francisco County' },
    { value: 'urn:li:geo:91000002', label: 'New York County' },
    { value: 'urn:li:geo:91000003', label: 'Middlesex County' },
    { value: 'urn:li:geo:91000004', label: 'Travis County' },
  ],
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const rows: LinkedInStagingExport['rows'] = reportDates.flatMap((reportDate, dateIndex) =>
  fixtureProductAdSets.flatMap((adSet, adSetIndex) =>
    demographicDimensionDefinitions.flatMap((
      dimension,
      pivotIndex
    ): LinkedInStagingExport['rows'] => {
      if (
        dateIndex % 7 === 0 &&
        adSetIndex === 2 &&
        dimension.sourcePivotType === 'MEMBER_COUNTY'
      ) {
        return [{
          reportDate,
          subjectKind: 'product_ad_set' as const,
          ...adSet,
          pivotType: dimension.sourcePivotType,
          pivotValue: null,
          pivotLabel: null,
          pivotLabelStatus: 'not_applicable' as const,
          evidenceKind: 'status_only' as const,
          coverageStatus: 'empty_observed' as const,
          privacyAdjusted: true as const,
          impressions: null,
          clicks: null,
          costInLocalCurrency: null,
          externalWebsiteConversions: null,
        }]
      }

      return pivotValues[dimension.sourcePivotType].map((pivot, valueIndex) => {
        const deliveryFactor =
          1 + dateIndex * 0.035 + adSetIndex * 0.09 + pivotIndex * 0.012 + valueIndex * 0.075
        const impressions = Math.round(420 * deliveryFactor)
        const clickRate = 0.011 + adSetIndex * 0.0012 + valueIndex * 0.0018 + dateIndex * 0.00018
        const clicks = Math.max(1, Math.round(impressions * clickRate))
        const externalWebsiteConversions = 0
        const cpm = 14.5 + adSetIndex * 1.1 + valueIndex * 1.45 + pivotIndex * 0.08

        return {
          reportDate,
          subjectKind: 'product_ad_set' as const,
          ...adSet,
          pivotType: dimension.sourcePivotType,
          pivotValue: pivot.value,
          pivotLabel:
            dimension.sourcePivotType === 'MEMBER_JOB_TITLE' && valueIndex === 3
              ? null
              : pivot.label,
          pivotLabelStatus:
            dimension.sourcePivotType === 'MEMBER_JOB_TITLE' && valueIndex === 3
              ? 'unresolved' as const
              : 'resolved' as const,
          evidenceKind: 'metric_observation' as const,
          coverageStatus: 'complete' as const,
          privacyAdjusted: true as const,
          impressions,
          clicks,
          costInLocalCurrency: roundMoney((impressions / 1000) * cpm),
          externalWebsiteConversions,
        }
      })
    })
  )
)

export const linkedinStagingFixtureExport: LinkedInStagingExport = {
  datasetId: PUBLIC_DEMO_DATASET.id,
  name: PUBLIC_DEMO_DATASET.name,
  provenance: PUBLIC_DEMO_DATASET.provenance,
  disclosure: PUBLIC_DEMO_DATASET.disclosure,
  client: PUBLIC_DEMO_CLIENT,
  sourceType: 'daily_provisional_directional',
  reportingLevel: 'CAMPAIGN',
  linkedinSourceEntityType: 'sponsoredCampaign',
  productSubjectType: 'product_ad_set',
  window: { startDate: reportDates[0], endDate: reportDates[reportDates.length - 1] },
  privacyAdjusted: true,
  qualitySemantics: {
    statusOnlyEvidencePreserved: true,
    unresolvedLabelsPreserved: true,
    missingMetricsAreNotZero: true,
    caveats: [
      'Directional sum of captured daily snapshots; not an exact-window demographic total or deduplicated reach.',
      'LinkedIn privacy thresholds and adjustments may suppress or revise rows.',
      'Status-only evidence is preserved and excluded from metric aggregation rather than treated as zero.',
      'Unresolved labels retain the source pivot value instead of inventing a display label.',
    ],
  },
  rows,
}

export const studioFixtureDataset = adaptLinkedInStagingExport(linkedinStagingFixtureExport)

assertPublicDemoDataset(studioFixtureDataset)
