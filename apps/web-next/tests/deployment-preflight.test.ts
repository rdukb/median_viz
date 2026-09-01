import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { executeAnalyticalQuery } from '../lib/analysis/query'
import { studioFixtureDataset } from '../lib/dataset/linkedin-staging-fixture'
import { createInitialWorkspaceState } from '../lib/workspace/reducer'
import { workspaceStateToQuery } from '../lib/workspace/selectors'
import { serializeDatasetInspection } from '../lib/webmcp/serializers'

const disclosure = 'Demo dataset — representative LinkedIn B2B audience performance data'

test('Studio and gallery disclose representative demo provenance without staging claims', () => {
  const studio = readFileSync('components/studio/StudioPrototype.tsx', 'utf8')
  const gallery = readFileSync('app/page.tsx', 'utf8')
  const identities = readFileSync('lib/dataset/public-demo-identities.ts', 'utf8')
  const contract = readFileSync('STUDIO_PROTOTYPE.md', 'utf8')
  assert.match(studio, /dataset\.disclosure/)
  assert.match(identities, new RegExp(disclosure))
  assert.match(contract, new RegExp(disclosure))
  assert.doesNotMatch(studio, /LinkedIn staging semantics/)
  assert.doesNotMatch(gallery, /staging fixture/i)
})

test('inspect_dataset reports representative provenance to agents', () => {
  const state = createInitialWorkspaceState(studioFixtureDataset)
  const output = serializeDatasetInspection({
    dataset: studioFixtureDataset,
    state,
    result: executeAnalyticalQuery(studioFixtureDataset, workspaceStateToQuery(state)),
  })
  assert.equal(output.dataset.provenance, 'representative_demo')
  assert.equal(output.dataset.disclosure, disclosure)
})

test('Vercel configuration uses the guarded build and Node 22', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
  assert.equal(packageJson.engines.node, '22.x')
  assert.match(packageJson.scripts.build, /privacy-scan\.mjs source/)
  assert.match(packageJson.scripts.build, /privacy-scan\.mjs build/)
  assert.equal(vercel.framework, 'nextjs')
  assert.equal(vercel.buildCommand, 'npm run build')
  assert.equal('public' in vercel, false)
  assert.match(readFileSync('../../.gitignore', 'utf8'), /^\.vercel\/$/m)
})

test('deployment preflight remains non-deploying and approval gated', () => {
  const preflight = readFileSync('scripts/deployment-preflight.mjs', 'utf8')
  const smoke = readFileSync('scripts/deployment-smoke.mjs', 'utf8')
  const contract = readFileSync('DEPLOYMENT_PREFLIGHT.md', 'utf8')
  assert.doesNotMatch(preflight, /vercel\s+(?:deploy|link|promote|rollback)/)
  assert.doesNotMatch(smoke, /vercel\s+(?:deploy|link|promote|rollback)/)
  assert.match(contract, /preview deployment;/)
  assert.match(contract, /production promotion;/)
  assert.match(contract, /requires a separate approval/i)
})

test('source binding excludes only the reviewed local process-manager file', () => {
  const preflight = readFileSync('scripts/deployment-preflight.mjs', 'utf8')
  assert.match(preflight, /--untracked-files=all/)
  assert.match(preflight, /\?\? apps\/web-next\/ecosystem\.config\.js/)
  assert.doesNotMatch(preflight, /--untracked-files=no/)
})
