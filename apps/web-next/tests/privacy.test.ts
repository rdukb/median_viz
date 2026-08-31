import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { executeAnalyticalQuery } from '../lib/analysis/query'
import { studioFixtureDataset } from '../lib/dataset/linkedin-staging-fixture'
import {
  assertPublicDemoDataset,
  assertPublicDemoIdentityRow,
  PUBLIC_DEMO_CLIENT,
  PUBLIC_DEMO_DATASET,
  PUBLIC_DEMO_PRODUCT_AD_SETS,
  PUBLIC_DEMO_PRODUCT_CAMPAIGNS,
} from '../lib/dataset/public-demo-identities'
import { buildPlotlyModel } from '../lib/visualization/plotly-model'
import { createWorkspaceCapabilities } from '../lib/workspace/capabilities'
import { createInitialWorkspaceState, createWorkspaceReducer } from '../lib/workspace/reducer'
import { workspaceStateToQuery } from '../lib/workspace/selectors'
import type { WorkspaceAction } from '../lib/workspace/types'

test('public demo identity registry is exactly the frozen Northstar contract', () => {
  assert.deepEqual(PUBLIC_DEMO_CLIENT, { id: 'client_demo_001', name: 'Northstar Media' })
  assert.equal(PUBLIC_DEMO_DATASET.provenance, 'representative_demo')
  assert.equal(
    PUBLIC_DEMO_DATASET.disclosure,
    'Demo dataset — representative LinkedIn B2B audience performance data'
  )
  assert.deepEqual(PUBLIC_DEMO_PRODUCT_CAMPAIGNS, [
    { id: 'pc_demo_001', name: 'Growth Leaders' },
    { id: 'pc_demo_002', name: 'Executive Reach' },
  ])
  assert.deepEqual(
    PUBLIC_DEMO_PRODUCT_AD_SETS.map((adSet) => ({ id: adSet.productAdSetId, name: adSet.productAdSetName })),
    [
      { id: 'pas_demo_001', name: 'Innovation Buyers' },
      { id: 'pas_demo_002', name: 'Revenue Leaders' },
      { id: 'pas_demo_003', name: 'Operations Decision Makers' },
    ]
  )
  assert.doesNotThrow(() => assertPublicDemoDataset(studioFixtureDataset))
})

test('identity validation rejects mismatched names and relationships', () => {
  const row = studioFixtureDataset.rows[0]
  assert.throws(
    () => assertPublicDemoIdentityRow({ ...row, productCampaignName: 'Unapproved Campaign' }),
    /canonical public demo mapping/
  )
  assert.throws(
    () => assertPublicDemoIdentityRow({ ...row, productAdSetId: 'pas_demo_003' }),
    /canonical public demo mapping/
  )
})

test('workspace identity state contains only the canonical public identities', () => {
  const state = createInitialWorkspaceState(studioFixtureDataset)
  assert.deepEqual(state.dataset.client, PUBLIC_DEMO_CLIENT)
  assert.deepEqual(state.dataset.productCampaigns, PUBLIC_DEMO_PRODUCT_CAMPAIGNS)
  assert.deepEqual(
    state.dataset.productAdSets.map(({ id, name }) => ({ id, name })),
    PUBLIC_DEMO_PRODUCT_AD_SETS.map((adSet) => ({ id: adSet.productAdSetId, name: adSet.productAdSetName }))
  )
})

test('workspace capabilities reject non-canonical filter identities without mutation', () => {
  const initial = createInitialWorkspaceState(studioFixtureDataset)
  const reducer = createWorkspaceReducer(initial)
  let state = initial
  const capabilities = createWorkspaceCapabilities({
    getState: () => state,
    dispatch: (action: WorkspaceAction) => { state = reducer(state, action) },
  })
  assert.throws(
    () => capabilities.applyFilter('productCampaignId', 'campaign_not_demo_safe'),
    /Workspace filter identity/
  )
  assert.equal(state.runtime.revision, 0)
  assert.equal(state.selection.filters.productCampaignId, 'all')
})

test('Agent Activity rejects arbitrary runtime text', () => {
  const initial = createInitialWorkspaceState(studioFixtureDataset)
  assert.throws(
    () => createWorkspaceReducer(initial)(initial, {
      type: 'apply_patch',
      actor: 'agent',
      label: 'Unapproved activity text.',
      patch: {},
    }),
    /Agent Activity label/
  )
})

test('Plotly Product Campaign labels and tooltips use only canonical names', () => {
  const state = {
    ...createInitialWorkspaceState(studioFixtureDataset),
    analysis: {
      ...createInitialWorkspaceState(studioFixtureDataset).analysis,
      comparisonDimension: 'product_campaign' as const,
    },
    visualization: { chartType: 'bar' as const },
  }
  const result = executeAnalyticalQuery(studioFixtureDataset, workspaceStateToQuery(state))
  assert.equal(result.ok, true)
  if (!result.ok) return
  const model = buildPlotlyModel(result, state)
  assert.deepEqual(result.comparisonValues, ['Executive Reach', 'Growth Leaders'])
  assert.deepEqual(model.data.map((trace) => trace.name), result.comparisonValues)
  for (const trace of model.data) {
    assert.ok(result.comparisonValues.includes(trace.name))
    assert.match(trace.hovertemplate, /Executive Reach|Growth Leaders/)
  }
})

test('Studio source does not persist workspace or identity state in the browser', () => {
  const sources = [
    readFileSync('components/studio/StudioPrototype.tsx', 'utf8'),
    readFileSync('components/studio/StudioWorkspaceProvider.tsx', 'utf8'),
    readFileSync('lib/workspace/reducer.ts', 'utf8'),
  ].join('\n')
  assert.doesNotMatch(sources, /\b(?:localStorage|sessionStorage|indexedDB)\b/)
})
