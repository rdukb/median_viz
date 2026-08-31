import {
  sourcePivotToDimension,
  type CoverageStatus,
  type DemographicDataset,
  type EvidenceKind,
  type LinkedInPivotType,
  type PivotLabelStatus,
} from './types'

export type LinkedInStagingExportRow = {
  reportDate: string
  subjectKind: 'product_ad_set'
  productCampaignId: string
  productCampaignName: string
  productAdSetId: string
  productAdSetName: string
  linkedinSourceCampaignUrn: string
  pivotType: LinkedInPivotType
  pivotValue: string | null
  pivotLabel: string | null
  pivotLabelStatus: PivotLabelStatus
  evidenceKind: EvidenceKind
  coverageStatus: CoverageStatus
  privacyAdjusted: true
  impressions: number | null
  clicks: number | null
  costInLocalCurrency: number | null
  externalWebsiteConversions: number | null
}

export type LinkedInStagingExport = {
  datasetId: string
  name: string
  provenance: DemographicDataset['provenance']
  disclosure: string
  client: { id: string; name: string }
  sourceType: 'daily_provisional_directional'
  reportingLevel: 'CAMPAIGN'
  linkedinSourceEntityType: 'sponsoredCampaign'
  productSubjectType: 'product_ad_set'
  window: { startDate: string; endDate: string }
  privacyAdjusted: true
  qualitySemantics: DemographicDataset['qualitySemantics']
  rows: LinkedInStagingExportRow[]
}

export class DatasetAdapterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatasetAdapterError'
  }
}

/**
 * Converts a staging-export-shaped payload into the Studio's canonical
 * dataset. A future CSV loader only needs to produce LinkedInStagingExport;
 * the Studio and analysis layers consume DemographicDataset unchanged.
 */
export function adaptLinkedInStagingExport(
  source: LinkedInStagingExport
): DemographicDataset {
  if (source.sourceType !== 'daily_provisional_directional') {
    throw new DatasetAdapterError(`Unsupported source type: ${source.sourceType}`)
  }
  if (source.reportingLevel !== 'CAMPAIGN') {
    throw new DatasetAdapterError(`Unsupported reporting level: ${source.reportingLevel}`)
  }
  if (source.window.startDate > source.window.endDate) {
    throw new DatasetAdapterError('Dataset window start must not exceed its end.')
  }

  return {
    datasetId: source.datasetId,
    name: source.name,
    provenance: source.provenance,
    disclosure: source.disclosure,
    client: { ...source.client },
    sourceType: source.sourceType,
    reportingLevel: source.reportingLevel,
    linkedinSourceEntityType: source.linkedinSourceEntityType,
    productSubjectType: source.productSubjectType,
    window: { ...source.window },
    privacyAdjusted: source.privacyAdjusted,
    qualitySemantics: {
      ...source.qualitySemantics,
      caveats: [...source.qualitySemantics.caveats],
    },
    rows: source.rows.map((row) => ({
      reportDate: row.reportDate,
      subjectKind: row.subjectKind,
      productCampaignId: row.productCampaignId,
      productCampaignName: row.productCampaignName,
      productAdSetId: row.productAdSetId,
      productAdSetName: row.productAdSetName,
      linkedinSourceCampaignUrn: row.linkedinSourceCampaignUrn,
      demographicDimension: sourcePivotToDimension[row.pivotType],
      sourcePivotType: row.pivotType,
      pivotValue: row.pivotValue,
      pivotLabel: row.pivotLabel,
      pivotLabelStatus: row.pivotLabelStatus,
      evidenceKind: row.evidenceKind,
      coverageStatus: row.coverageStatus,
      privacyAdjusted: row.privacyAdjusted,
      impressions: row.impressions,
      clicks: row.clicks,
      spend: row.costInLocalCurrency,
      conversions: row.externalWebsiteConversions,
    })),
  }
}
