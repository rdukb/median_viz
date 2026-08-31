import test from 'node:test'
import assert from 'node:assert/strict'
import { runAutomatedWebMcpEvaluations } from '../evals/webmcp-eval-runner'
import { webMcpEvaluationScenarios } from '../evals/webmcp-scenarios'
import { STUDIO_WEBMCP_TOOL_NAMES } from '../lib/webmcp/schemas'

test('evaluation matrix covers intent, transition, revision, privacy, and recovery', () => {
  assert.ok(webMcpEvaluationScenarios.length >= 15)
  assert.equal(
    new Set(webMcpEvaluationScenarios.map((scenario) => scenario.id)).size,
    webMcpEvaluationScenarios.length
  )
  const frozenTools = new Set<string>(STUDIO_WEBMCP_TOOL_NAMES)
  for (const scenario of webMcpEvaluationScenarios) {
    assert.ok(scenario.prompts.length > 0, `${scenario.id} needs prompts`)
    assert.ok(scenario.expectedTools.every((tool) => frozenTools.has(tool)))
    assert.ok(scenario.expectedWorkspaceTransition.length > 0)
    assert.ok(scenario.expectedResult.length > 0)
    assert.ok(scenario.expectedRevisionBehavior.length > 0)
    assert.ok(scenario.privacyExpectations.length >= 2)
    assert.ok(scenario.failureRecovery.length > 0)
  }
})

test('evaluation matrix keeps natural-language routing claims live-only where needed', () => {
  const ambiguous = webMcpEvaluationScenarios.find(
    (scenario) => scenario.id === 'minimal-tool-selection'
  )
  assert.equal(ambiguous?.verification, 'live_chatgpt')
  const staleHuman = webMcpEvaluationScenarios.find(
    (scenario) => scenario.id === 'stale-human-race'
  )
  assert.equal(staleHuman?.verification, 'automated')
})

test('deterministic WebMCP interaction evaluation passes', async () => {
  const report = await runAutomatedWebMcpEvaluations()
  assert.equal(
    report.passed,
    true,
    report.results.filter((result) => !result.passed).map((result) => `${result.id}: ${result.evidence}`).join('\n')
  )
  assert.ok(report.results.length >= 12)
})
