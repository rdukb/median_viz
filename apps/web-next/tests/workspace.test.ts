import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { studioFixtureDataset } from '../lib/dataset/linkedin-staging-fixture'
import { createWorkspaceCapabilities } from '../lib/workspace/capabilities'
import {
  createInitialWorkspaceState,
  createWorkspaceReducer,
} from '../lib/workspace/reducer'
import type { WorkspaceAction } from '../lib/workspace/types'

test('workspace revision increments on successful state-changing capabilities', () => {
  const initial = createInitialWorkspaceState(studioFixtureDataset)
  const reducer = createWorkspaceReducer(initial)
  let state = initial
  const capabilities = createWorkspaceCapabilities({
    getState: () => state,
    dispatch: (action: WorkspaceAction) => {
      state = reducer(state, action)
    },
  })

  capabilities.setMetric('clicks')
  assert.equal(state.analysis.metric, 'clicks')
  assert.equal(state.runtime.revision, 1)

  capabilities.setComparisonDimension('product_ad_set')
  assert.equal(state.analysis.comparisonDimension, 'product_ad_set')
  assert.equal(state.runtime.revision, 2)

  capabilities.applyFilter('productCampaignId', 'pc_demo_002')
  assert.equal(state.selection.filters.productCampaignId, 'pc_demo_002')
  assert.equal(state.selection.filters.productAdSetId, 'all')
  assert.equal(state.runtime.revision, 3)
})

test('invalid visualization capability calls do not mutate workspace state', () => {
  const initial = createInitialWorkspaceState(studioFixtureDataset)
  const reducer = createWorkspaceReducer(initial)
  let state = initial
  const capabilities = createWorkspaceCapabilities({
    getState: () => state,
    dispatch: (action: WorkspaceAction) => {
      state = reducer(state, action)
    },
  })

  const result = capabilities.setVisualization('heatmap')
  assert.deepEqual(result, {
    ok: false,
    code: 'unsupported_visualization_combination',
  })
  assert.equal(state.runtime.revision, 0)
  assert.equal(state.visualization.chartType, 'bar')
})

test('comparison changes repair chart and animation state consistently', () => {
  const initial = createInitialWorkspaceState(studioFixtureDataset)
  const reducer = createWorkspaceReducer(initial)
  let state = initial
  const capabilities = createWorkspaceCapabilities({
    getState: () => state,
    dispatch: (action: WorkspaceAction) => { state = reducer(state, action) },
  })

  capabilities.setAnimation({ enabled: true, playing: true })
  capabilities.setComparisonDimension('time')
  capabilities.setAnimation({ enabled: true, playing: true })
  const result = capabilities.configureView({
    analysis: { comparisonDimension: 'product_ad_set' },
  })

  assert.deepEqual(result, { ok: true })
  assert.equal(state.analysis.comparisonDimension, 'product_ad_set')
  assert.equal(state.visualization.chartType, 'bar')
  assert.deepEqual(state.animation, {
    enabled: false,
    playing: false,
    currentFrame: '2026-08-08',
  })
})

test('reversed human date ranges fail without changing state', () => {
  const initial = createInitialWorkspaceState(studioFixtureDataset)
  const reducer = createWorkspaceReducer(initial)
  let state = initial
  const capabilities = createWorkspaceCapabilities({
    getState: () => state,
    dispatch: (action: WorkspaceAction) => { state = reducer(state, action) },
  })

  const result = capabilities.setDateRange('2026-08-20', '2026-08-08')

  assert.deepEqual(result, { ok: false, code: 'invalid_date_range' })
  assert.equal(state, initial)
})

test('queued animation ticks cannot advance after playback stops', () => {
  const initial = createInitialWorkspaceState(studioFixtureDataset)
  const reducer = createWorkspaceReducer(initial)
  let state = initial
  const capabilities = createWorkspaceCapabilities({
    getState: () => state,
    dispatch: (action: WorkspaceAction) => { state = reducer(state, action) },
  })
  const allFrames = Array.from({ length: 14 }, (_, index) =>
    `2026-08-${String(8 + index).padStart(2, '0')}`
  )

  capabilities.setAnimation({
    enabled: true,
    playing: true,
    currentFrame: '2026-08-12',
  })
  capabilities.setDateRange('2026-08-12', '2026-08-14')
  const beforeQueuedTick = state
  capabilities.advanceAnimationFrame(allFrames)

  assert.equal(state, beforeQueuedTick)
  assert.equal(state.animation.currentFrame, '2026-08-12')
  assert.equal(state.animation.playing, false)
})

test('agent capabilities write Agent Activity against the shared revision', () => {
  const initial = createInitialWorkspaceState(studioFixtureDataset)
  const reducer = createWorkspaceReducer(initial)
  let state = initial
  const capabilities = createWorkspaceCapabilities({
    getState: () => state,
    dispatch: (action: WorkspaceAction) => {
      state = reducer(state, action)
    },
  })

  capabilities.setDemographicDimension('seniority', {
    actor: 'agent',
    activityKey: 'switchSeniority',
  })
  assert.equal(state.runtime.revision, 1)
  assert.equal(state.story.agentActivity[0].label, 'Switched the active independent pivot to Seniority.')
  assert.equal(state.story.agentActivity[0].revision, 1)
})

test('Studio human controls call capabilities rather than reducer internals', () => {
  const source = readFileSync('components/studio/StudioPrototype.tsx', 'utf8')
  assert.match(source, /useStudioWorkspace\(\)/)
  assert.match(source, /capabilities\.setMetric/)
  assert.match(source, /capabilities\.setDemographicDimension/)
  assert.match(source, /capabilities\.setComparisonDimension/)
  assert.match(source, /capabilities\.applyFilter/)
  assert.match(source, /capabilities\.setDateRange/)
  assert.match(source, /capabilities\.setVisualization/)
  assert.match(source, /capabilities\.setAnimation/)
  assert.doesNotMatch(source, /useReducer/)
  assert.doesNotMatch(source, /dispatch\s*\(/)
  assert.doesNotMatch(source, /workspaceReducer/)
})
