import type { DemographicDataset, DemographicObservation } from './types'

export const PUBLIC_DEMO_CLIENT = {
  id: 'client_demo_001',
  name: 'Northstar Media',
} as const

export const PUBLIC_DEMO_DATASET = {
  id: 'dataset_demo_001',
  name: 'Northstar Media LinkedIn daily demographics',
  provenance: 'representative_demo',
  disclosure: 'Demo dataset — representative LinkedIn B2B audience performance data',
} as const

export const PUBLIC_DEMO_PRODUCT_CAMPAIGNS = [
  { id: 'pc_demo_001', name: 'Growth Leaders' },
  { id: 'pc_demo_002', name: 'Executive Reach' },
] as const

export const PUBLIC_DEMO_PRODUCT_AD_SETS = [
  {
    productCampaignId: 'pc_demo_001',
    productCampaignName: 'Growth Leaders',
    productAdSetId: 'pas_demo_001',
    productAdSetName: 'Innovation Buyers',
    linkedinSourceCampaignUrn: 'urn:linkedin-demo:sponsoredCampaign:lsc_demo_001',
  },
  {
    productCampaignId: 'pc_demo_001',
    productCampaignName: 'Growth Leaders',
    productAdSetId: 'pas_demo_002',
    productAdSetName: 'Revenue Leaders',
    linkedinSourceCampaignUrn: 'urn:linkedin-demo:sponsoredCampaign:lsc_demo_002',
  },
  {
    productCampaignId: 'pc_demo_002',
    productCampaignName: 'Executive Reach',
    productAdSetId: 'pas_demo_003',
    productAdSetName: 'Operations Decision Makers',
    linkedinSourceCampaignUrn: 'urn:linkedin-demo:sponsoredCampaign:lsc_demo_003',
  },
] as const

export const PUBLIC_DEMO_AGENT_ACTIVITY_LABELS = {
  ready: 'Agent is ready and shares the selected LinkedIn pivot view.',
  switchSeniority: 'Switched the active independent pivot to Seniority.',
  compareProductAdSets: 'Compared Product Ad Sets within the selected demographic pivot.',
  compareProductCampaigns: 'Compared Product Campaigns without crossing demographic pivots.',
  dailyTrend: 'Changed the current demographic pivot to an Aug 8–21 daily trend.',
  highlightHighCpa: 'Highlighted the highest available CPA value within the selected demographic pivot.',
  reset: 'Reset the view while keeping the Aug 8–21 fixture loaded.',
  webmcpConfigureAnalysis: 'Agent configured the analysis through WebMCP.',
  webmcpApplyFilters: 'Agent applied workspace filters through WebMCP.',
  webmcpSetAnimation: 'Agent configured daily animation through WebMCP.',
  webmcpResetView: 'Agent reset the analysis through WebMCP while preserving the dataset.',
} as const

export type PublicDemoAgentActivityKey = keyof typeof PUBLIC_DEMO_AGENT_ACTIVITY_LABELS

export class PublicDemoPrivacyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublicDemoPrivacyError'
  }
}

const campaignById = new Map(
  PUBLIC_DEMO_PRODUCT_CAMPAIGNS.map((campaign) => [campaign.id, campaign])
)
const adSetById = new Map(
  PUBLIC_DEMO_PRODUCT_AD_SETS.map((adSet) => [adSet.productAdSetId, adSet])
)
const safeActivityLabels = new Set<string>(Object.values(PUBLIC_DEMO_AGENT_ACTIVITY_LABELS))

type IdentityBearingRow = Pick<
  DemographicObservation,
  | 'productCampaignId'
  | 'productCampaignName'
  | 'productAdSetId'
  | 'productAdSetName'
  | 'linkedinSourceCampaignUrn'
>

export function assertPublicDemoIdentityRow(row: IdentityBearingRow): void {
  const campaign = campaignById.get(row.productCampaignId as typeof PUBLIC_DEMO_PRODUCT_CAMPAIGNS[number]['id'])
  const adSet = adSetById.get(row.productAdSetId as typeof PUBLIC_DEMO_PRODUCT_AD_SETS[number]['productAdSetId'])
  if (
    !campaign ||
    !adSet ||
    row.productCampaignName !== campaign.name ||
    row.productCampaignId !== adSet.productCampaignId ||
    row.productCampaignName !== adSet.productCampaignName ||
    row.productAdSetName !== adSet.productAdSetName ||
    row.linkedinSourceCampaignUrn !== adSet.linkedinSourceCampaignUrn
  ) {
    throw new PublicDemoPrivacyError('Dataset contains an identity outside the canonical public demo mapping.')
  }
}

const sameMembers = (actual: Set<string>, expected: readonly string[]) =>
  actual.size === expected.length && expected.every((value) => actual.has(value))

export function assertPublicDemoDataset(dataset: DemographicDataset): void {
  if (
    dataset.datasetId !== PUBLIC_DEMO_DATASET.id ||
    dataset.name !== PUBLIC_DEMO_DATASET.name ||
    dataset.provenance !== PUBLIC_DEMO_DATASET.provenance ||
    dataset.disclosure !== PUBLIC_DEMO_DATASET.disclosure ||
    dataset.client.id !== PUBLIC_DEMO_CLIENT.id ||
    dataset.client.name !== PUBLIC_DEMO_CLIENT.name
  ) {
    throw new PublicDemoPrivacyError('Dataset metadata is outside the canonical public demo mapping.')
  }

  dataset.rows.forEach(assertPublicDemoIdentityRow)
  if (
    !sameMembers(
      new Set(dataset.rows.map((row) => row.productCampaignId)),
      PUBLIC_DEMO_PRODUCT_CAMPAIGNS.map((campaign) => campaign.id)
    ) ||
    !sameMembers(
      new Set(dataset.rows.map((row) => row.productAdSetId)),
      PUBLIC_DEMO_PRODUCT_AD_SETS.map((adSet) => adSet.productAdSetId)
    )
  ) {
    throw new PublicDemoPrivacyError('Dataset must contain exactly the canonical public demo identities.')
  }
}

export function assertPublicDemoFilterValue(
  filter: 'productCampaignId' | 'productAdSetId',
  value: string
): void {
  if (value === 'all') return
  const valid = filter === 'productCampaignId'
    ? campaignById.has(value as typeof PUBLIC_DEMO_PRODUCT_CAMPAIGNS[number]['id'])
    : adSetById.has(value as typeof PUBLIC_DEMO_PRODUCT_AD_SETS[number]['productAdSetId'])
  if (!valid) {
    throw new PublicDemoPrivacyError('Workspace filter identity is outside the canonical public demo mapping.')
  }
}

export function assertPublicDemoWorkspaceIdentities(workspaceDataset: {
  client: { id: string; name: string }
  productCampaigns: Array<{ id: string; name: string }>
  productAdSets: Array<{ id: string; name: string; productCampaignId: string }>
}): void {
  if (
    workspaceDataset.client.id !== PUBLIC_DEMO_CLIENT.id ||
    workspaceDataset.client.name !== PUBLIC_DEMO_CLIENT.name ||
    workspaceDataset.productCampaigns.length !== PUBLIC_DEMO_PRODUCT_CAMPAIGNS.length ||
    workspaceDataset.productAdSets.length !== PUBLIC_DEMO_PRODUCT_AD_SETS.length
  ) {
    throw new PublicDemoPrivacyError('Workspace contains identities outside the canonical public demo mapping.')
  }

  for (const campaign of workspaceDataset.productCampaigns) {
    const canonical = campaignById.get(campaign.id as typeof PUBLIC_DEMO_PRODUCT_CAMPAIGNS[number]['id'])
    if (!canonical || campaign.name !== canonical.name) {
      throw new PublicDemoPrivacyError('Workspace contains identities outside the canonical public demo mapping.')
    }
  }
  for (const adSet of workspaceDataset.productAdSets) {
    const canonical = adSetById.get(adSet.id as typeof PUBLIC_DEMO_PRODUCT_AD_SETS[number]['productAdSetId'])
    if (
      !canonical ||
      adSet.name !== canonical.productAdSetName ||
      adSet.productCampaignId !== canonical.productCampaignId
    ) {
      throw new PublicDemoPrivacyError('Workspace contains identities outside the canonical public demo mapping.')
    }
  }
}

export function publicDemoAgentActivityLabel(key: PublicDemoAgentActivityKey): string {
  return PUBLIC_DEMO_AGENT_ACTIVITY_LABELS[key]
}

export function assertPublicDemoAgentActivityLabel(label: string): void {
  if (!safeActivityLabels.has(label)) {
    throw new PublicDemoPrivacyError('Agent Activity label is outside the canonical public demo vocabulary.')
  }
}

export function assertPublicDemoComparisonValues(
  comparison: 'product_campaign' | 'product_ad_set',
  values: string[]
): void {
  const allowed = new Set<string>(
    comparison === 'product_campaign'
      ? PUBLIC_DEMO_PRODUCT_CAMPAIGNS.map((campaign) => campaign.name)
      : PUBLIC_DEMO_PRODUCT_AD_SETS.map((adSet) => adSet.productAdSetName)
  )
  if (values.some((value) => !allowed.has(value))) {
    throw new PublicDemoPrivacyError('Chart comparison label is outside the canonical public demo mapping.')
  }
}
