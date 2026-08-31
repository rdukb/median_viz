import test from 'node:test'
import assert from 'node:assert/strict'
import { executeAnalyticalQuery } from '../lib/analysis/query'
import { studioFixtureDataset } from '../lib/dataset/linkedin-staging-fixture'
import { createWorkspaceCapabilities, type WorkspaceCapabilities } from '../lib/workspace/capabilities'
import { createInitialWorkspaceState, createWorkspaceReducer } from '../lib/workspace/reducer'
import { workspaceStateToQuery } from '../lib/workspace/selectors'
import type { WorkspaceAction } from '../lib/workspace/types'
import { createStudioWebMcpTools, type WebMcpToolDefinition } from '../lib/webmcp/register-tools'
import type { StudioWebMcpSnapshot } from '../lib/webmcp/serializers'

function createHarness() {
  const dataset = studioFixtureDataset
  const initial = createInitialWorkspaceState(dataset)
  const reducer = createWorkspaceReducer(initial)
  let state = initial
  const capabilities = createWorkspaceCapabilities({
    getState: () => state,
    dispatch: (action: WorkspaceAction) => { state = reducer(state, action) },
  })
  const snapshot = (): StudioWebMcpSnapshot => ({
    dataset,
    state,
    result: executeAnalyticalQuery(dataset, workspaceStateToQuery(state)),
  })
  return { dataset, capabilities, getState: () => state, snapshot }
}

async function callMutation(
  tools: WebMcpToolDefinition[],
  name: 'configure_analysis' | 'apply_filters' | 'set_animation' | 'reset_view',
  input: Record<string, unknown>
) {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Missing ${name}`)
  return tool.execute(input) as Promise<any>
}

test('all four mutation tools call workspace capabilities and increment exactly once', async () => {
  const harness = createHarness()
  const calls = { configureView: 0, resetView: 0 }
  const original = harness.capabilities
  const capabilities: WorkspaceCapabilities = {
    ...original,
    configureView(patch, context) {
      calls.configureView += 1
      return original.configureView(patch, context)
    },
    resetView(context) {
      calls.resetView += 1
      return original.resetView(context)
    },
  }
  const tools = createStudioWebMcpTools(harness.snapshot, capabilities)

  const configured = await callMutation(tools, 'configure_analysis', {
    metric: 'cpc',
    demographicDimension: 'industry',
    comparisonDimension: 'product_ad_set',
    visualization: 'bar',
    expectedRevision: 0,
  })
  assert.deepEqual(
    { ok: configured.ok, previous: configured.previousRevision, next: configured.newRevision },
    { ok: true, previous: 0, next: 1 }
  )
  assert.equal(harness.getState().story.agentActivity[0].label, 'Agent configured the analysis through WebMCP.')

  const filtered = await callMutation(tools, 'apply_filters', {
    mode: 'replace',
    productCampaignId: 'pc_demo_001',
    expectedRevision: 1,
  })
  assert.deepEqual(
    { ok: filtered.ok, previous: filtered.previousRevision, next: filtered.newRevision },
    { ok: true, previous: 1, next: 2 }
  )
  assert.equal(harness.getState().story.agentActivity[0].label, 'Agent applied workspace filters through WebMCP.')

  const animated = await callMutation(tools, 'set_animation', {
    mode: 'day_by_day',
    expectedRevision: 2,
  })
  assert.deepEqual(
    { ok: animated.ok, previous: animated.previousRevision, next: animated.newRevision },
    { ok: true, previous: 2, next: 3 }
  )
  assert.equal(harness.getState().story.agentActivity[0].label, 'Agent configured daily animation through WebMCP.')

  const datasetBeforeReset = harness.dataset
  const datasetIdentityBeforeReset = harness.getState().dataset
  const reset = await callMutation(tools, 'reset_view', { expectedRevision: 3 })
  assert.deepEqual(
    { ok: reset.ok, previous: reset.previousRevision, next: reset.newRevision },
    { ok: true, previous: 3, next: 4 }
  )
  assert.equal(harness.dataset, datasetBeforeReset)
  assert.equal(harness.getState().dataset, datasetIdentityBeforeReset)
  assert.equal(harness.getState().story.agentActivity[0].label, 'Agent reset the analysis through WebMCP while preserving the dataset.')
  assert.deepEqual(calls, { configureView: 3, resetView: 1 })
})

test('stale expectedRevision fails closed without changing state', async () => {
  const harness = createHarness()
  harness.capabilities.setMetric('clicks')
  const tools = createStudioWebMcpTools(harness.snapshot, harness.capabilities)
  const before = harness.getState()
  const output = await callMutation(tools, 'configure_analysis', {
    metric: 'cpc',
    expectedRevision: 0,
  })
  assert.equal(output.ok, false)
  assert.equal(output.error.code, 'stale_workspace_revision')
  assert.deepEqual(output.error.details, { expectedRevision: 0, actualRevision: 1 })
  assert.equal(harness.getState(), before)
})

test('invalid visualization and comparison fails through capabilities without mutation', async () => {
  const harness = createHarness()
  const tools = createStudioWebMcpTools(harness.snapshot, harness.capabilities)
  const before = harness.getState()
  const output = await callMutation(tools, 'configure_analysis', {
    comparisonDimension: 'time',
    visualization: 'bar',
    expectedRevision: 0,
  })
  assert.equal(output.ok, false)
  assert.equal(output.error.code, 'unsupported_visualization_combination')
  assert.equal(output.previousRevision, 0)
  assert.equal(output.newRevision, 0)
  assert.equal(harness.getState(), before)
})

test('cross-demographic mutation returns the frozen structured error without mutation', async () => {
  const harness = createHarness()
  const tools = createStudioWebMcpTools(harness.snapshot, harness.capabilities)
  const before = harness.getState()
  const output = await callMutation(tools, 'configure_analysis', {
    demographicDimension: ['job_function', 'seniority'],
    expectedRevision: 0,
  })
  assert.deepEqual(output.error, {
    code: 'unsupported_demographic_intersection',
    message: 'LinkedIn demographic pivots are independent. An analytical query must select exactly one demographic dimension.',
    details: {
      requestedDemographicDimensions: ['job_function', 'seniority'],
      requiredCount: 1,
    },
  })
  assert.equal(output.newRevision, 0)
  assert.equal(harness.getState(), before)
})

test('invalid filter and animation inputs fail without state change', async () => {
  const harness = createHarness()
  const tools = createStudioWebMcpTools(harness.snapshot, harness.capabilities)
  const before = harness.getState()

  const identityFailure = await callMutation(tools, 'apply_filters', {
    mode: 'replace',
    productCampaignId: 'campaign_not_demo_safe',
  })
  assert.equal(identityFailure.ok, false)
  assert.equal(identityFailure.error.code, 'invalid_tool_input')
  assert.equal(harness.getState(), before)

  const animationFailure = await callMutation(tools, 'set_animation', {
    enabled: false,
    playing: true,
  })
  assert.equal(animationFailure.ok, false)
  assert.equal(animationFailure.error.code, 'invalid_tool_input')
  assert.equal(harness.getState(), before)
})

test('WebMCP writes are immediately visible through workspace reads and human state', async () => {
  const harness = createHarness()
  const tools = createStudioWebMcpTools(harness.snapshot, harness.capabilities)
  const mutation = await callMutation(tools, 'configure_analysis', {
    metric: 'cpc',
    demographicDimension: 'industry',
    comparisonDimension: 'product_ad_set',
    visualization: 'bar',
  })
  const readTool = tools.find((tool) => tool.name === 'get_workspace_state')
  if (!readTool) throw new Error('Missing read tool')
  const readState = await readTool.execute({}) as any
  assert.equal(mutation.state.metric, 'cpc')
  assert.equal(readState.metric, 'cpc')
  assert.equal(readState.demographicDimension, 'industry')
  assert.equal(readState.comparisonDimension, 'product_ad_set')
  assert.equal(harness.getState().analysis.metric, 'cpc')
  assert.equal(harness.getState().visualization.chartType, 'bar')
})

test('partial mutation inputs leave unrelated workspace fields unchanged', async () => {
  const harness = createHarness()
  harness.capabilities.setAnimation({ enabled: true, playing: true, currentFrame: '2026-08-12' })
  const tools = createStudioWebMcpTools(harness.snapshot, harness.capabilities)
  const animationBefore = { ...harness.getState().animation }
  const datesBefore = {
    startDate: harness.getState().selection.startDate,
    endDate: harness.getState().selection.endDate,
  }
  const configured = await callMutation(tools, 'configure_analysis', {
    metric: 'cpc',
    expectedRevision: 1,
  })
  assert.equal(configured.ok, true)
  assert.deepEqual(harness.getState().animation, animationBefore)

  const filtered = await callMutation(tools, 'apply_filters', {
    mode: 'replace',
    productCampaignId: 'pc_demo_001',
    expectedRevision: 2,
  })
  assert.equal(filtered.ok, true)
  assert.deepEqual(
    {
      startDate: harness.getState().selection.startDate,
      endDate: harness.getState().selection.endDate,
    },
    datesBefore
  )
  assert.deepEqual(harness.getState().animation, animationBefore)
})

test('mutation input output and Agent Activity stay within public-demo privacy bounds', async () => {
  const harness = createHarness()
  const tools = createStudioWebMcpTools(harness.snapshot, harness.capabilities)
  const output = await callMutation(tools, 'apply_filters', {
    mode: 'replace',
    productCampaignId: 'pc_demo_001',
    productAdSetId: 'pas_demo_002',
  })
  const serialized = JSON.stringify({ output, activity: harness.getState().story.agentActivity })
  const ids = serialized.match(/\b(?:client|pc|pas)_[a-zA-Z0-9_-]+\b/g) ?? []
  assert.ok(ids.every((id) => ['pc_demo_001', 'pas_demo_002'].includes(id)))
  assert.doesNotMatch(serialized, /sponsoredCampaign|linkedinSourceCampaignUrn|"rows"\s*:/i)
  assert.equal(harness.getState().story.agentActivity[0].label, 'Agent applied workspace filters through WebMCP.')
})
