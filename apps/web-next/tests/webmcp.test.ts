import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateMetric } from '../lib/analysis/metrics'
import { executeAnalyticalQuery } from '../lib/analysis/query'
import type { DemographicDataset } from '../lib/dataset/types'
import { studioFixtureDataset } from '../lib/dataset/linkedin-staging-fixture'
import {
  PUBLIC_DEMO_CLIENT,
  PUBLIC_DEMO_PRODUCT_AD_SETS,
  PUBLIC_DEMO_PRODUCT_CAMPAIGNS,
} from '../lib/dataset/public-demo-identities'
import { createWorkspaceCapabilities } from '../lib/workspace/capabilities'
import { createInitialWorkspaceState, createWorkspaceReducer } from '../lib/workspace/reducer'
import { workspaceStateToQuery } from '../lib/workspace/selectors'
import type { WorkspaceAction, WorkspaceState } from '../lib/workspace/types'
import {
  createStudioWebMcpTools,
  getActiveDocumentModelContext,
  registerStudioWebMcpTools,
  type WebMcpModelContext,
  type WebMcpToolDefinition,
} from '../lib/webmcp/register-tools'
import {
  STUDIO_WEBMCP_MUTATION_TOOL_NAMES,
  STUDIO_WEBMCP_READ_TOOL_NAMES,
  STUDIO_WEBMCP_TOOL_NAMES,
} from '../lib/webmcp/schemas'
import {
  RESULT_SEGMENT_LIMIT,
  TOOL_RESULT_CHARACTER_LIMIT,
  serializeCurrentResultSummary,
  serializeDatasetInspection,
  serializeWorkspaceState,
  type StudioWebMcpSnapshot,
} from '../lib/webmcp/serializers'

function createHarness(dataset: DemographicDataset = studioFixtureDataset) {
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
  return { capabilities, getState: () => state, snapshot }
}

function toolOutput<T>(tools: WebMcpToolDefinition[], name: string): Promise<T> {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return tool.execute({}) as Promise<T>
}

test('WebMCP exposes exactly three read tools and four guarded mutation tools', () => {
  const harness = createHarness()
  const tools = createStudioWebMcpTools(harness.snapshot, harness.capabilities)
  assert.deepEqual(tools.map((tool) => tool.name), STUDIO_WEBMCP_TOOL_NAMES)
  const readTools = tools.filter((tool) => tool.annotations.readOnlyHint)
  const mutationTools = tools.filter((tool) => !tool.annotations.readOnlyHint)
  assert.deepEqual(readTools.map((tool) => tool.name), STUDIO_WEBMCP_READ_TOOL_NAMES)
  assert.deepEqual(mutationTools.map((tool) => tool.name), STUDIO_WEBMCP_MUTATION_TOOL_NAMES)
  for (const tool of readTools) {
    assert.deepEqual(tool.inputSchema, {
      type: 'object',
      properties: {},
      additionalProperties: false,
    })
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      untrustedContentHint: false,
    })
  }
  for (const tool of mutationTools) {
    assert.equal(tool.inputSchema.type, 'object')
    assert.equal(tool.inputSchema.additionalProperties, false)
    assert.deepEqual(tool.annotations, {
      readOnlyHint: false,
      untrustedContentHint: false,
    })
  }
})

test('inspect_dataset returns exactly the nine approved demographics', () => {
  const output = serializeDatasetInspection(createHarness().snapshot())
  assert.equal(output.demographicDimensions.length, 9)
  assert.deepEqual(output.demographicDimensions.map((dimension) => dimension.key), [
    'job_function', 'seniority', 'job_title', 'company', 'company_size',
    'industry', 'country', 'region', 'county',
  ])
  assert.deepEqual(output.identityCounts, { productCampaigns: 2, productAdSets: 3 })
})

test('inspect_dataset reports cross-demographic intersections as unsupported', () => {
  const output = serializeDatasetInspection(createHarness().snapshot())
  assert.deepEqual(output.constraints, {
    demographicIntersectionSupported: false,
    requiredDemographicDimensionCount: 1,
    errorCode: 'unsupported_demographic_intersection',
  })
})

test('get_workspace_state reflects human capability changes', async () => {
  const harness = createHarness()
  const tools = createStudioWebMcpTools(harness.snapshot, harness.capabilities)
  harness.capabilities.setMetric('cpc')
  harness.capabilities.setDemographicDimension('industry')
  harness.capabilities.setComparisonDimension('product_ad_set')
  harness.capabilities.applyFilter('productCampaignId', 'pc_demo_001')
  const output = await toolOutput<ReturnType<typeof serializeWorkspaceState>>(tools, 'get_workspace_state')
  assert.equal(output.workspaceRevision, 4)
  assert.equal(output.metric, 'cpc')
  assert.equal(output.demographicDimension, 'industry')
  assert.equal(output.comparisonDimension, 'product_ad_set')
  assert.deepEqual(output.filters.productCampaign, { id: 'pc_demo_001', label: 'Growth Leaders' })
})

test('get_workspace_state reflects animation.currentFrame', () => {
  const harness = createHarness()
  harness.capabilities.setAnimation({ enabled: true, currentFrame: '2026-08-14', playing: false })
  const output = serializeWorkspaceState(harness.snapshot())
  assert.deepEqual(output.animation, {
    enabled: true,
    playing: false,
    currentFrame: '2026-08-14',
  })
})

test('get_current_result_summary uses the current metric and filters', () => {
  const harness = createHarness()
  harness.capabilities.setMetric('spend')
  harness.capabilities.setDemographicDimension('company_size')
  harness.capabilities.applyFilter('productAdSetId', 'pas_demo_002')
  const output = serializeCurrentResultSummary(harness.snapshot())
  assert.equal(output.metric, 'spend')
  assert.equal(output.demographicDimension, 'company_size')
  assert.deepEqual(output.filters.productAdSet, { id: 'pas_demo_002', label: 'Revenue Leaders' })
  assert.ok(output.topSegments.length > 0)
})

test('result summary uses aggregate-safe CPC from the analysis engine', () => {
  const harness = createHarness()
  harness.capabilities.setMetric('cpc')
  harness.capabilities.setDemographicDimension('industry')
  harness.capabilities.applyFilter('productAdSetId', 'pas_demo_001')
  const snapshot = harness.snapshot()
  assert.equal(snapshot.result.ok, true)
  const output = serializeCurrentResultSummary(snapshot)
  if (!snapshot.result.ok) return
  assert.equal(output.totals.currentMetricValue, calculateMetric(snapshot.result.totals, 'cpc'))
  assert.equal(output.totals.currentMetricValue, snapshot.result.totals.spend / snapshot.result.totals.clicks)
})

test('unavailable CPA and CVR remain supported but unavailable', () => {
  const zeroConversionDataset: DemographicDataset = {
    ...studioFixtureDataset,
    rows: studioFixtureDataset.rows.map((row) => ({ ...row, conversions: row.evidenceKind === 'status_only' ? null : 0 })),
  }
  for (const metric of ['cpa', 'cvr'] as const) {
    const harness = createHarness(zeroConversionDataset)
    harness.capabilities.setMetric(metric)
    const output = serializeCurrentResultSummary(harness.snapshot())
    assert.deepEqual(output.metricAvailability, {
      supported: true,
      available: false,
      unavailableReason: 'no_conversions_for_derived_metric',
    })
    assert.equal(output.totals.currentMetricValue, null)
    assert.deepEqual(output.topSegments, [])
  }
})

test('status-only evidence is reported as unavailable rather than zero', () => {
  const harness = createHarness()
  harness.capabilities.setDemographicDimension('county')
  harness.capabilities.applyFilter('productAdSetId', 'pas_demo_003')
  harness.capabilities.setDateRange('2026-08-08', '2026-08-08')
  const output = serializeCurrentResultSummary(harness.snapshot())
  assert.equal(output.metricAvailability.available, false)
  assert.equal(output.metricAvailability.unavailableReason, 'no_metric_observations')
  assert.deepEqual(output.totals, {
    metricObservationCount: 0,
    impressions: null,
    clicks: null,
    spend: null,
    conversions: null,
    currentMetricValue: null,
  })
  assert.equal(output.evidence.statusOnlyEvidenceCount, 1)
  assert.deepEqual(output.topSegments, [])
})

test('all WebMCP outputs contain only approved fictional identities', () => {
  const snapshot = createHarness().snapshot()
  const serialized = JSON.stringify([
    serializeDatasetInspection(snapshot),
    serializeWorkspaceState(snapshot),
    serializeCurrentResultSummary(snapshot),
  ])
  const identityTokens = serialized.match(/\b(?:client|pc|pas)_[a-zA-Z0-9_-]+\b/g) ?? []
  const approved = new Set<string>([
    PUBLIC_DEMO_CLIENT.id,
    ...PUBLIC_DEMO_PRODUCT_CAMPAIGNS.map((campaign) => campaign.id),
    ...PUBLIC_DEMO_PRODUCT_AD_SETS.map((adSet) => adSet.productAdSetId),
  ])
  assert.ok(identityTokens.every((identity) => approved.has(identity)))
  assert.doesNotMatch(serialized, /sponsoredCampaign|linkedinSourceCampaignUrn|"rows"\s*:/i)
})

test('current result output is deterministically bounded', () => {
  const output = serializeCurrentResultSummary(createHarness().snapshot())
  assert.ok(output.topSegments.length <= RESULT_SEGMENT_LIMIT)
  assert.ok(output.bottomSegments.length <= RESULT_SEGMENT_LIMIT)
  assert.ok(JSON.stringify(output).length <= TOOL_RESULT_CHARACTER_LIMIT)
})

test('missing WebMCP support leaves registration disabled without changing Studio state', () => {
  const unsupportedDocument = { defaultView: {} } as Document
  const harness = createHarness()
  const before = harness.getState()
  assert.equal(getActiveDocumentModelContext(unsupportedDocument), null)
  assert.deepEqual(harness.getState(), before)
})

test('duplicate registration aborts the old lifecycle and keeps exactly seven tools', async () => {
  const registered = new Map<string, WebMcpToolDefinition>()
  const modelContext: WebMcpModelContext = {
    async registerTool(tool, options) {
      if (registered.has(tool.name)) throw new Error(`duplicate ${tool.name}`)
      registered.set(tool.name, tool)
      options?.signal?.addEventListener('abort', () => registered.delete(tool.name), { once: true })
    },
  }
  const harness = createHarness()
  const cleanupFirst = await registerStudioWebMcpTools(modelContext, harness.snapshot, harness.capabilities)
  assert.deepEqual([...registered.keys()], STUDIO_WEBMCP_TOOL_NAMES)
  const cleanupSecond = await registerStudioWebMcpTools(modelContext, harness.snapshot, harness.capabilities)
  assert.deepEqual([...registered.keys()], STUDIO_WEBMCP_TOOL_NAMES)
  cleanupFirst()
  assert.deepEqual([...registered.keys()], STUDIO_WEBMCP_TOOL_NAMES)
  cleanupSecond()
  assert.equal(registered.size, 0)
})
