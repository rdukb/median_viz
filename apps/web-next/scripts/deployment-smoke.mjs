const target = process.argv[2] || process.env.DEPLOYMENT_PREFLIGHT_BASE_URL
if (!target) {
  console.error('Provide a preview URL: npm run smoke:deployment -- https://preview.example')
  process.exit(2)
}

const baseUrl = new URL(target)
if (baseUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(baseUrl.hostname)) {
  console.error('Hosted smoke targets must use HTTPS.')
  process.exit(2)
}

const disclosure = 'Demo dataset — representative LinkedIn B2B audience performance data'
const routes = ['/studio', '/pie', '/bar', '/map']
const checks = []
let studioHtml = ''

for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl), { redirect: 'follow' })
  const body = await response.text()
  if (route === '/studio') studioHtml = body
  checks.push({
    status: response.status === 200 ? 'PASS' : 'FAIL',
    id: `route-${route.slice(1)}`,
    message: `${route} returned ${response.status}.`,
  })
  if (route === '/studio') {
    checks.push({
      status: response.headers.get('origin-agent-cluster') === '?1' ? 'PASS' : 'FAIL',
      id: 'origin-agent-cluster',
      message: '/studio returns Origin-Agent-Cluster: ?1.',
    })
  }
}

checks.push({
  status: studioHtml.includes(disclosure) ? 'PASS' : 'FAIL',
  id: 'representative-disclosure',
  message: 'Hosted /studio contains the representative-demo disclosure.',
})

const encodedDenylist = process.env.DEMO_PRIVATE_DENYLIST_BASE64
if (encodedDenylist) {
  const terms = Buffer.from(encodedDenylist, 'base64').toString('utf8')
    .split(/\r?\n/)
    .map((term) => term.trim())
    .filter((term) => term && !term.startsWith('#'))
  const leaked = terms.some((term) => studioHtml.toLocaleLowerCase().includes(term.toLocaleLowerCase()))
  checks.push({
    status: leaked ? 'FAIL' : 'PASS',
    id: 'hosted-private-denylist',
    message: leaked
      ? 'Hosted HTML matched a private privacy term.'
      : 'Hosted HTML passed the private privacy denylist without exposing its values.',
  })
} else {
  checks.push({
    status: 'BLOCKED',
    id: 'hosted-private-denylist',
    message: 'Set DEMO_PRIVATE_DENYLIST_BASE64 before hosted smoke verification.',
  })
}

checks.push({
  status: 'PENDING',
  id: 'chatgpt-webmcp-discovery',
  message: 'Open the preview in ChatGPT built-in browser and verify exactly seven tools; HTTP smoke cannot prove browser tool discovery.',
})

for (const check of checks) {
  console.log(`${check.status.padEnd(7)} ${check.id}: ${check.message}`)
}
if (checks.some((check) => check.status === 'FAIL' || check.status === 'BLOCKED')) {
  process.exitCode = 1
}
