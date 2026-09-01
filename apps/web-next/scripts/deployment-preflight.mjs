import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(appRoot, '../..')
const strict = process.argv.includes('--strict')
const disclosure = 'Demo dataset — representative LinkedIn B2B audience performance data'
const expectedTools = [
  'inspect_dataset',
  'get_workspace_state',
  'get_current_result_summary',
  'configure_analysis',
  'apply_filters',
  'set_animation',
  'reset_view',
]
const reviewedLocalOnlyStatusEntries = new Set([
  '?? apps/web-next/ecosystem.config.js',
])

const checks = []
const add = (status, id, message) => checks.push({ status, id, message })
const read = (path) => readFileSync(join(appRoot, path), 'utf8')
const readJson = (path) => JSON.parse(read(path))

function generatedOutputContains(marker) {
  const root = join(appRoot, '.next')
  if (!existsSync(root)) return false
  const visit = (path) => {
    const info = statSync(path)
    if (info.isDirectory()) return readdirSync(path).some((entry) => visit(join(path, entry)))
    return readFileSync(path).toString('utf8').includes(marker)
  }
  return visit(root)
}

function git(args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim()
}

try {
  const packageJson = readJson('package.json')
  add(
    packageJson.engines?.node === '22.x' ? 'PASS' : 'FAIL',
    'node-runtime',
    'package.json pins the Vercel-supported Node.js 22.x major.'
  )
  add(
    packageJson.scripts?.build?.includes('privacy-scan.mjs source') &&
      packageJson.scripts?.build?.includes('privacy-scan.mjs build')
      ? 'PASS' : 'FAIL',
    'privacy-build-gate',
    'The production build scans both source and generated output.'
  )

  const vercel = readJson('vercel.json')
  add(
    vercel.framework === 'nextjs' && vercel.buildCommand === 'npm run build'
      ? 'PASS' : 'FAIL',
    'vercel-config',
    'vercel.json selects Next.js and the guarded build command.'
  )

  const nextConfig = read('next.config.mjs')
  add(
    nextConfig.includes('Origin-Agent-Cluster') && nextConfig.includes('source: "/studio"')
      ? 'PASS' : 'FAIL',
    'webmcp-origin-isolation',
    '/studio declares Origin-Agent-Cluster: ?1 for hosted WebMCP compatibility.'
  )

  const identities = read('lib/dataset/public-demo-identities.ts')
  const studio = read('components/studio/StudioPrototype.tsx')
  const gallery = read('app/page.tsx')
  const contract = read('STUDIO_PROTOTYPE.md')
  add(
    identities.includes("provenance: 'representative_demo'") &&
      identities.includes(disclosure) &&
      studio.includes('dataset.disclosure') &&
      contract.includes(disclosure)
      ? 'PASS' : 'FAIL',
    'representative-provenance',
    'Canonical data, UI, and contract identify the fixture as representative demo data.'
  )
  add(
    !studio.includes('LinkedIn staging semantics') &&
      !gallery.includes('staging fixture')
      ? 'PASS' : 'FAIL',
    'no-live-data-implication',
    'User-visible source copy does not imply live, production, or staging-derived performance.'
  )

  const toolSchema = read('lib/webmcp/schemas.ts')
  add(
    expectedTools.every((tool) => toolSchema.includes(`'${tool}'`))
      ? 'PASS' : 'FAIL',
    'frozen-webmcp-surface',
    'All seven frozen WebMCP tool names remain declared.'
  )

  const routeArtifacts = ['/studio', '/pie', '/bar', '/map'].every((route) =>
    existsSync(join(appRoot, `.next/server/app${route}/page.js`))
  )
  add(
    routeArtifacts ? 'PASS' : 'FAIL',
    'build-routes',
    'Generated Next.js output contains /studio, /pie, /bar, and /map.'
  )
  add(
    generatedOutputContains(disclosure) ? 'PASS' : 'FAIL',
    'generated-disclosure',
    'Generated Next.js output contains the representative-demo disclosure.'
  )
} catch (error) {
  add('FAIL', 'static-preflight-exception', error instanceof Error ? error.message : String(error))
}

const linkedProject = existsSync(join(appRoot, '.vercel/project.json')) ||
  Boolean(process.env.VERCEL_ORG_ID && process.env.VERCEL_PROJECT_ID)
add(
  linkedProject ? 'PASS' : 'BLOCKED',
  'vercel-project-link',
  linkedProject
    ? 'A Vercel project binding is available without exposing its identifiers.'
    : 'No .vercel/project.json or VERCEL_ORG_ID/VERCEL_PROJECT_ID binding is present.'
)

const privateDenylist = Boolean(
  process.env.DEMO_PRIVATE_DENYLIST_BASE64 ||
  process.env.PUBLIC_DEMO_PRIVATE_DENYLIST_PATH
)
add(
  privateDenylist ? 'PASS' : 'BLOCKED',
  'private-privacy-denylist',
  privateDenylist
    ? 'A private privacy denylist is present without reading or printing its value.'
    : 'DEMO_PRIVATE_DENYLIST_BASE64 or an external denylist path is required for preview and production builds.'
)

try {
  const deployScopeStatus = git(['status', '--porcelain=v1', '--untracked-files=all', '--', 'apps/web-next'])
  const blockingDeployScopeEntries = deployScopeStatus
    .split('\n')
    .filter(Boolean)
    .filter((entry) => !reviewedLocalOnlyStatusEntries.has(entry))
  const deployScopeIsClean = blockingDeployScopeEntries.length === 0
  add(
    deployScopeIsClean ? 'PASS' : 'BLOCKED',
    'immutable-source-binding',
    deployScopeIsClean
      ? `Deployable app files are clean at commit ${git(['rev-parse', 'HEAD']).slice(0, 12)}; reviewed local-only files are excluded.`
      : 'Deployable app changes are not committed; a hosted build cannot be bound to the verified local source yet.'
  )
} catch (error) {
  add('FAIL', 'git-source-check', error instanceof Error ? error.message : String(error))
}

add(
  process.env.DEPLOYMENT_PREFLIGHT_BASE_URL ? 'PASS' : 'PENDING',
  'hosted-smoke-target',
  process.env.DEPLOYMENT_PREFLIGHT_BASE_URL
    ? 'A hosted preview URL is supplied for smoke testing.'
    : 'No hosted preview URL exists; run npm run smoke:deployment -- https://preview.example after separate deployment approval.'
)

add(
  process.env.VERCEL_ROLLBACK_DEPLOYMENT_URL ? 'PASS' : 'BLOCKED',
  'rollback-baseline',
  process.env.VERCEL_ROLLBACK_DEPLOYMENT_URL
    ? 'A last-known-good production deployment URL is recorded without printing it.'
    : 'No last-known-good production deployment is recorded. First release must remain preview-only until approval, or establish a rollback baseline.'
)

const summary = {
  readyForDeploymentApproval:
    !checks.some((check) => check.status === 'FAIL' || check.status === 'BLOCKED'),
  checks,
}

for (const check of checks) {
  console.log(`${check.status.padEnd(7)} ${check.id}: ${check.message}`)
}
console.log(JSON.stringify({ readyForDeploymentApproval: summary.readyForDeploymentApproval }))

if (checks.some((check) => check.status === 'FAIL')) process.exitCode = 1
else if (strict && checks.some((check) => check.status === 'BLOCKED')) process.exitCode = 2
