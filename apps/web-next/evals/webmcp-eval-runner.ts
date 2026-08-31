import { executeAnalyticalQuery } from '../lib/analysis/query'
import { studioFixtureDataset } from '../lib/dataset/linkedin-staging-fixture'
import { createWorkspaceCapabilities } from '../lib/workspace/capabilities'
import { createInitialWorkspaceState, createWorkspaceReducer } from '../lib/workspace/reducer'
import { workspaceStateToQuery } from '../lib/workspace/selectors'
import type { WorkspaceAction } from '../lib/workspace/types'
import { createStudioWebMcpTools, type WebMcpToolDefinition } from '../lib/webmcp/register-tools'
import {
  RESULT_SEGMENT_LIMIT,
  TOOL_RESULT_CHARACTER_LIMIT,
  type StudioWebMcpSnapshot,
} from '../lib/webmcp/serializers'
import {
  STUDIO_WEBMCP_TOOL_NAMES,
  studioWebMcpInputSchemas,
  type StudioWebMcpToolName,
} from '../lib/webmcp/schemas'

export type AutomatedEvaluationResult = {
  id: string
  passed: boolean
  evidence: string
}

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
  const tools = createStudioWebMcpTools(snapshot, capabilities)
  return { dataset, capabilities, getState: () => state, snapshot, tools }
}

async function call(
  tools: WebMcpToolDefinition[],
  name: StudioWebMcpToolName,
  input: Record<string, unknown> = {}
): Promise<any> {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return tool.execute(input)
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function evaluate(
  id: string,
  run: () => Promise<string> | string
): Promise<AutomatedEvaluationResult> {
  try {
    return { id, passed: true, evidence: await run() }
  } catch (error) {
    return {
      id,
      passed: false,
      evidence: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runAutomatedWebMcpEvaluations() {
  const results: AutomatedEvaluationResult[] = []

  results.push(await evaluate('frozen-tool-surface', async () => {
    const harness = createHarness()
    expect(
      JSON.stringify(harness.tools.map((tool) => tool.name)) === JSON.stringify(STUDIO_WEBMCP_TOOL_NAMES),
      'Tool surface changed.'
    )
    return 'Exactly three read tools and four mutation tools.'
  }))

  results.push(await evaluate('dataset-discovery', async () => {
    const harness = createHarness()
    const before = harness.getState().runtime.revision
    const output = await call(harness.tools, 'inspect_dataset')
    expect(output.demographicDimensions.length === 9, 'Expected exactly nine pivots.')
    expect(harness.getState().runtime.revision === before, 'Dataset inspection mutated state.')
    return 'Nine pivots returned at unchanged revision 0.'
  }))

  results.push(await evaluate('basic-analysis-and-filter-refinement', async () => {
    const harness = createHarness()
    const configured = await call(harness.tools, 'configure_analysis', {
      metric: 'cpc',
      demographicDimension: 'industry',
      comparisonDimension: 'product_ad_set',
      visualization: 'bar',
      expectedRevision: 0,
    })
    expect(configured.ok && configured.newRevision === 1, 'Analysis configuration failed.')
    const filtered = await call(harness.tools, 'apply_filters', {
      mode: 'replace',
      productCampaignId: 'pc_demo_001',
      expectedRevision: 1,
    })
    expect(filtered.ok && filtered.newRevision === 2, 'Filter refinement failed.')
    expect(filtered.state.metric === 'cpc', 'Filter replaced metric.')
    expect(filtered.state.demographicDimension === 'industry', 'Filter replaced pivot.')
    expect(filtered.state.comparisonDimension === 'product_ad_set', 'Filter replaced comparison.')
    const summary = await call(harness.tools, 'get_current_result_summary')
    expect(harness.getState().runtime.revision === 2, 'Summary read mutated state.')
    expect(summary.filters.productCampaign.id === 'pc_demo_001', 'Summary ignored campaign filter.')
    return 'Configured revision 1, refined revision 2, grounded read stayed at 2.'
  }))

  results.push(await evaluate('human-agent-partial-refinement', async () => {
    const harness = createHarness()
    harness.capabilities.setMetric('ctr')
    harness.capabilities.setDemographicDimension('seniority')
    const refined = await call(harness.tools, 'configure_analysis', {
      comparisonDimension: 'product_ad_set',
      expectedRevision: 2,
    })
    expect(refined.newRevision === 3, 'Agent refinement did not increment once.')
    expect(refined.state.metric === 'ctr', 'Human metric was overwritten.')
    expect(refined.state.demographicDimension === 'seniority', 'Human pivot was overwritten.')
    return 'Human revisions 1–2 preserved; agent changed only comparison at revision 3.'
  }))

  results.push(await evaluate('animation-frame-read', async () => {
    const harness = createHarness()
    const animated = await call(harness.tools, 'set_animation', {
      mode: 'day_by_day',
      playing: false,
      currentFrame: '2026-08-12',
      expectedRevision: 0,
    })
    expect(animated.newRevision === 1, 'Animation configuration failed.')
    const state = await call(harness.tools, 'get_workspace_state')
    expect(state.animation.currentFrame === '2026-08-12', 'Current frame was not canonical.')
    expect(state.comparisonDimension === 'time', 'Time comparison was not selected.')
    expect(state.visualization.chartType === 'line', 'Line visualization was not selected.')
    return 'Paused frame 2026-08-12 read at unchanged revision 1.'
  }))

  results.push(await evaluate('unsupported-semantic-requests', async () => {
    const harness = createHarness()
    const intersection = await call(harness.tools, 'configure_analysis', {
      demographicDimension: ['job_function', 'seniority'],
      expectedRevision: 0,
    })
    expect(intersection.error.code === 'unsupported_demographic_intersection', 'Wrong intersection error.')
    const device = await call(harness.tools, 'configure_analysis', { demographicDimension: 'device' })
    const roas = await call(harness.tools, 'configure_analysis', { metric: 'roas' })
    expect(device.error.code === 'invalid_tool_input', 'Device should be rejected.')
    expect(roas.error.code === 'invalid_tool_input', 'ROAS should be rejected.')
    expect(harness.getState().runtime.revision === 0, 'Unsupported request mutated state.')

    const configureSchema = studioWebMcpInputSchemas.configure_analysis as any
    const dimensionEnum = configureSchema.properties.demographicDimension.oneOf[0].enum
    const metricEnum = configureSchema.properties.metric.enum
    expect(!dimensionEnum.includes('device') && !dimensionEnum.includes('state'), 'Unsupported dimension leaked into schema.')
    expect(!metricEnum.includes('roas'), 'Unsupported metric leaked into schema.')
    return 'Intersection, Device, State, and ROAS remain unsupported at revision 0.'
  }))

  results.push(await evaluate('supported-unavailable-cpa-recovery', async () => {
    const harness = createHarness()
    const cpa = await call(harness.tools, 'configure_analysis', {
      metric: 'cpa',
      expectedRevision: 0,
    })
    expect(cpa.newRevision === 1, 'CPA configuration failed.')
    const unavailable = await call(harness.tools, 'get_current_result_summary')
    expect(unavailable.metricAvailability.supported === true, 'CPA should be supported.')
    expect(unavailable.metricAvailability.available === false, 'CPA should be unavailable.')
    expect(unavailable.metricAvailability.unavailableReason === 'no_conversions_for_derived_metric', 'Wrong CPA reason.')
    expect(unavailable.totals.currentMetricValue === null, 'Unavailable CPA must be null.')
    expect(unavailable.topSegments.length === 0, 'Unavailable CPA must have no ranked segments.')
    const cpc = await call(harness.tools, 'configure_analysis', {
      metric: 'cpc',
      expectedRevision: 1,
    })
    expect(cpc.newRevision === 2, 'CPC recovery failed.')
    const recovered = await call(harness.tools, 'get_current_result_summary')
    expect(recovered.metricAvailability.available === true, 'CPC should recover the chart.')
    return 'CPA unavailable at revision 1; CPC recovered at revision 2.'
  }))

  results.push(await evaluate('stale-human-race-recovery', async () => {
    const harness = createHarness()
    const read = await call(harness.tools, 'get_workspace_state')
    harness.capabilities.setMetric('ctr')
    const stale = await call(harness.tools, 'configure_analysis', {
      demographicDimension: 'industry',
      expectedRevision: read.workspaceRevision,
    })
    expect(stale.error.code === 'stale_workspace_revision', 'Human race did not fail stale.')
    expect(harness.getState().runtime.revision === 1, 'Stale human race changed revision.')
    expect(harness.getState().analysis.metric === 'ctr', 'Newer human metric was lost.')
    const latest = await call(harness.tools, 'get_workspace_state')
    const retry = await call(harness.tools, 'configure_analysis', {
      demographicDimension: 'industry',
      expectedRevision: latest.workspaceRevision,
    })
    expect(retry.newRevision === 2, 'Human race retry did not increment once.')
    expect(retry.state.metric === 'ctr', 'Retry overwrote reconciled human metric.')
    return 'Read 0 → human 1 → stale remains 1 → reconciled retry 2.'
  }))

  results.push(await evaluate('stale-animation-race-recovery', async () => {
    const harness = createHarness()
    const animated = await call(harness.tools, 'set_animation', {
      mode: 'day_by_day',
      playing: true,
      expectedRevision: 0,
    })
    expect(animated.newRevision === 1, 'Animation did not start at revision 1.')
    const read = await call(harness.tools, 'get_workspace_state')
    harness.capabilities.advanceAnimationFrame([
      '2026-08-08', '2026-08-09', '2026-08-10',
    ])
    const stale = await call(harness.tools, 'set_animation', {
      playing: false,
      expectedRevision: read.workspaceRevision,
    })
    expect(stale.error.code === 'stale_workspace_revision', 'Animation race did not fail stale.')
    expect(harness.getState().runtime.revision === 2, 'Stale animation race mutated state.')
    const latest = await call(harness.tools, 'get_workspace_state')
    const retry = await call(harness.tools, 'set_animation', {
      playing: false,
      expectedRevision: latest.workspaceRevision,
    })
    expect(retry.newRevision === 3, 'Animation retry did not increment once.')
    expect(retry.state.animation.currentFrame === '2026-08-09', 'Latest frame was not preserved.')
    return 'Animation 1 → frame 2 → stale remains 2 → latest-frame pause 3.'
  }))

  results.push(await evaluate('human-agent-handoff', async () => {
    const harness = createHarness()
    const revisions = [harness.getState().runtime.revision]
    harness.capabilities.applyFilter('productCampaignId', 'pc_demo_001')
    revisions.push(harness.getState().runtime.revision)
    const agentConfigured = await call(harness.tools, 'configure_analysis', {
      metric: 'cpc',
      demographicDimension: 'industry',
      expectedRevision: 1,
    })
    revisions.push(agentConfigured.newRevision)
    harness.capabilities.setComparisonDimension('product_ad_set')
    revisions.push(harness.getState().runtime.revision)
    const agentAnimated = await call(harness.tools, 'set_animation', {
      mode: 'day_by_day',
      expectedRevision: 3,
    })
    revisions.push(agentAnimated.newRevision)
    harness.capabilities.setAnimation({ playing: false, currentFrame: '2026-08-15' })
    revisions.push(harness.getState().runtime.revision)

    const finalState = await call(harness.tools, 'get_workspace_state')
    const finalSummary = await call(harness.tools, 'get_current_result_summary')
    expect(JSON.stringify(revisions) === JSON.stringify([0, 1, 2, 3, 4, 5]), 'Revision sequence is incoherent.')
    expect(finalState.filters.productCampaign.id === 'pc_demo_001', 'Human campaign filter was lost.')
    expect(finalState.metric === 'cpc' && finalState.demographicDimension === 'industry', 'Agent analysis was lost.')
    expect(finalState.comparisonDimension === 'time' && finalState.visualization.chartType === 'line', 'Animation view is inconsistent.')
    expect(finalState.animation.currentFrame === '2026-08-15' && finalState.animation.playing === false, 'Human pause frame is wrong.')
    expect(finalSummary.currentTimeFrame.currentFrame === '2026-08-15', 'Summary ignored current frame.')
    expect(harness.getState().story.agentActivity.length === 3, 'Human changes should not masquerade as agent activity.')
    return 'Human/agent sequence 0→1→2→3→4→5 preserved every contribution.'
  }))

  results.push(await evaluate('semantic-no-op', async () => {
    const harness = createHarness()
    const outputs = [
      await call(harness.tools, 'configure_analysis', { metric: 'impressions', expectedRevision: 0 }),
      await call(harness.tools, 'apply_filters', { mode: 'replace', productCampaignId: 'all', expectedRevision: 0 }),
      await call(harness.tools, 'set_animation', { enabled: false, playing: false, expectedRevision: 0 }),
      await call(harness.tools, 'reset_view', { expectedRevision: 0 }),
    ]
    expect(outputs.every((output) => output.ok && output.noOp), 'Identical requests should return noOp.')
    expect(outputs.every((output) => output.newRevision === 0), 'No-op changed revision.')
    expect(harness.getState().story.agentActivity.length === 1, 'No-op created Agent Activity.')
    return 'Four already-active requests stayed at revision 0 with no activity entry.'
  }))

  results.push(await evaluate('bounded-grounded-summary-and-privacy', async () => {
    const harness = createHarness()
    const summary = await call(harness.tools, 'get_current_result_summary')
    const workspace = await call(harness.tools, 'get_workspace_state')
    const inspection = await call(harness.tools, 'inspect_dataset')
    expect(summary.topSegments.length <= RESULT_SEGMENT_LIMIT, 'Top segments exceeded bound.')
    expect(summary.bottomSegments.length <= RESULT_SEGMENT_LIMIT, 'Bottom segments exceeded bound.')
    const serialized = JSON.stringify({ summary, workspace, inspection })
    expect(serialized.length <= TOOL_RESULT_CHARACTER_LIMIT, 'Combined evidence exceeded single-result bound.')
    expect(!/sponsoredCampaign|linkedinSourceCampaignUrn|"rows"\s*:/i.test(serialized), 'Forbidden source data leaked.')
    expect(!/plotly|trace|hovertemplate/i.test(serialized), 'Renderer internals leaked.')
    return `Top/bottom bounded at ${summary.topSegments.length}/${summary.bottomSegments.length}; no raw or renderer data.`
  }))

  return {
    passed: results.every((result) => result.passed),
    results,
  }
}

if (require.main === module) {
  void runAutomatedWebMcpEvaluations().then((report) => {
    console.log(JSON.stringify(report, null, 2))
    if (!report.passed) process.exitCode = 1
  })
}
