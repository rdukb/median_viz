import type { MetricKey, ComparisonDimension, AnalysisFilters } from '../analysis/types'
import type { DemographicDimension } from '../dataset/types'
import type { PublicDemoAgentActivityKey } from '../dataset/public-demo-identities'

export type ChartType = 'bar' | 'heatmap' | 'line'
export type CapabilityActor = 'human' | 'agent'
export type HighlightMode = 'none' | 'high-cpa'

export type ActivityItem = {
  id: number
  revision: number
  label: string
}

export type WorkspaceState = {
  dataset: {
    datasetId: string
    client: { id: string; name: string }
    productCampaigns: Array<{ id: string; name: string }>
    productAdSets: Array<{
      id: string
      name: string
      productCampaignId: string
    }>
    loaded: true
  }
  selection: {
    filters: AnalysisFilters
    startDate: string
    endDate: string
  }
  analysis: {
    metric: MetricKey
    demographicDimension: DemographicDimension
    comparisonDimension: ComparisonDimension
    highlightMode: HighlightMode
  }
  visualization: {
    chartType: ChartType
  }
  animation: {
    enabled: boolean
    currentFrame: string
    playing: boolean
  }
  story: {
    agentActivity: ActivityItem[]
  }
  runtime: {
    revision: number
    nextActivityId: number
  }
}

export type WorkspacePatch = {
  selection?: Partial<WorkspaceState['selection']>
  analysis?: Partial<WorkspaceState['analysis']>
  visualization?: Partial<WorkspaceState['visualization']>
  animation?: Partial<WorkspaceState['animation']>
}

export type WorkspaceAction =
  | {
      type: 'apply_patch'
      actor: CapabilityActor
      label: string
      patch: WorkspacePatch
    }
  | {
      type: 'reset_view'
      actor: CapabilityActor
      label: string
    }

export type CapabilityContext =
  | { actor?: 'human'; activityKey?: never }
  | { actor: 'agent'; activityKey: PublicDemoAgentActivityKey }

export type WorkspaceFilterName = 'productCampaignId' | 'productAdSetId'
