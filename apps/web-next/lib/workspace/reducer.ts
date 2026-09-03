import type { DemographicDataset } from '../dataset/types'
import {
  assertPublicDemoAgentActivityLabel,
  assertPublicDemoDataset,
  PUBLIC_DEMO_AGENT_ACTIVITY_LABELS,
  PUBLIC_DEMO_PRODUCT_AD_SETS,
  PUBLIC_DEMO_PRODUCT_CAMPAIGNS,
} from '../dataset/public-demo-identities'
import type { WorkspaceAction, WorkspaceState } from './types'

export function createInitialWorkspaceState(dataset: DemographicDataset): WorkspaceState {
  assertPublicDemoDataset(dataset)
  return {
    dataset: {
      datasetId: dataset.datasetId,
      client: { ...dataset.client },
      productCampaigns: PUBLIC_DEMO_PRODUCT_CAMPAIGNS.map((campaign) => ({ ...campaign })),
      productAdSets: PUBLIC_DEMO_PRODUCT_AD_SETS.map((adSet) => ({
        id: adSet.productAdSetId,
        name: adSet.productAdSetName,
        productCampaignId: adSet.productCampaignId,
      })),
      loaded: true,
    },
    selection: {
      filters: { productCampaignId: 'all', productAdSetId: 'all' },
      startDate: dataset.window.startDate,
      endDate: dataset.window.endDate,
    },
    analysis: {
      metric: 'impressions',
      demographicDimension: 'job_function',
      comparisonDimension: 'none',
      highlightMode: 'none',
    },
    visualization: { chartType: 'bar' },
    animation: {
      enabled: false,
      currentFrame: dataset.window.startDate,
      playing: false,
    },
    story: {
      agentActivity: [{
        id: 1,
        revision: 0,
        label: PUBLIC_DEMO_AGENT_ACTIVITY_LABELS.ready,
      }],
    },
    runtime: { revision: 0, nextActivityId: 2 },
  }
}

export const mergeWorkspacePatch = (
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'apply_patch' }>
): WorkspaceState => ({
  ...state,
  selection: { ...state.selection, ...action.patch.selection },
  analysis: { ...state.analysis, ...action.patch.analysis },
  visualization: { ...state.visualization, ...action.patch.visualization },
  animation: { ...state.animation, ...action.patch.animation },
})

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
  initialState: WorkspaceState
): WorkspaceState {
  const revision = state.runtime.revision + 1
  const nextBase = action.type === 'reset_view'
    ? {
        ...initialState,
        story: state.story,
        runtime: { ...state.runtime, revision },
      }
    : {
        ...mergeWorkspacePatch(state, action),
        runtime: { ...state.runtime, revision },
      }

  if (action.actor !== 'agent') return nextBase

  assertPublicDemoAgentActivityLabel(action.label)

  return {
    ...nextBase,
    story: {
      agentActivity: [{
        id: state.runtime.nextActivityId,
        revision,
        label: action.label,
      }, ...state.story.agentActivity].slice(0, 8),
    },
    runtime: {
      revision,
      nextActivityId: state.runtime.nextActivityId + 1,
    },
  }
}

export const createWorkspaceReducer = (initialState: WorkspaceState) =>
  (state: WorkspaceState, action: WorkspaceAction) =>
    workspaceReducer(state, action, initialState)
