import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2] ?? 'all'
const registryPath = join(appRoot, 'lib/dataset/public-demo-identities.ts')
const registrySource = readFileSync(registryPath, 'utf8')
const identityTokenPattern = /\b(?:client|pc|pas)_[a-zA-Z0-9_-]+\b/g
const canonicalIdentityTokens = new Set(registrySource.match(identityTokenPattern) ?? [])

if (canonicalIdentityTokens.size !== 6) {
  throw new Error('Public demo identity registry must define exactly one client, two Product Campaigns, and three Product Ad Sets.')
}

const textExtensions = new Set([
  '', '.css', '.csv', '.html', '.js', '.json', '.map', '.md', '.mjs', '.tsx', '.ts', '.txt',
])
const excludedDirectories = new Set(['.git', '.next', '.test-dist', 'node_modules'])

function collectFiles(root, excludeGenerated = false) {
  if (!existsSync(root)) return []
  const files = []
  const visit = (path) => {
    const info = statSync(path)
    if (info.isDirectory()) {
      if (excludeGenerated && excludedDirectories.has(path.split(sep).at(-1))) return
      for (const entry of readdirSync(path)) visit(join(path, entry))
      return
    }
    if (textExtensions.has(extname(path))) files.push(path)
  }
  visit(root)
  return files
}

function externalPrivacyTerms() {
  const configuredPath = process.env.PUBLIC_DEMO_PRIVATE_DENYLIST_PATH
  const configuredBase64 = process.env.PUBLIC_DEMO_PRIVATE_DENYLIST_BASE64
  if (configuredPath && configuredBase64) {
    throw new Error('Configure only one private privacy denylist source.')
  }
  let content = ''
  if (configuredPath) {
    const denylistPath = resolve(configuredPath)
    if (denylistPath === appRoot || denylistPath.startsWith(`${appRoot}${sep}`)) {
      throw new Error('The private privacy denylist must remain outside the public repository.')
    }
    content = readFileSync(denylistPath, 'utf8')
  } else if (configuredBase64) {
    content = Buffer.from(configuredBase64, 'base64').toString('utf8')
  }
  return content
    .split(/\r?\n/)
    .map((term) => term.trim())
    .filter((term) => term && !term.startsWith('#'))
}

function scan(files, { forbidPersistence = false, requireCanonicalTokens = false } = {}) {
  const privateTerms = externalPrivacyTerms()
  const combined = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    combined.push(content)
    const identityTokens = content.match(identityTokenPattern) ?? []
    const unexpectedToken = identityTokens.find((token) => !canonicalIdentityTokens.has(token))
    if (unexpectedToken) {
      throw new Error(`Non-canonical public demo identity token found in ${relative(appRoot, file)}.`)
    }
    if (
      forbidPersistence &&
      /\b(?:localStorage|sessionStorage|indexedDB)\b/.test(content)
    ) {
      throw new Error(`Browser-persisted demo state is not allowed in ${relative(appRoot, file)}.`)
    }
    privateTerms.forEach((term, index) => {
      if (content.toLocaleLowerCase().includes(term.toLocaleLowerCase())) {
        throw new Error(`External private privacy term ${index + 1} found in ${relative(appRoot, file)}.`)
      }
    })
  }
  if (requireCanonicalTokens) {
    const output = combined.join('\n')
    for (const token of canonicalIdentityTokens) {
      if (!output.includes(token)) {
        throw new Error('Generated output is missing a canonical public demo identity token.')
      }
    }
  }
}

if (mode === 'source' || mode === 'all') {
  scan(collectFiles(appRoot, true))
  scan([
    ...collectFiles(join(appRoot, 'app')),
    ...collectFiles(join(appRoot, 'components')),
    ...collectFiles(join(appRoot, 'lib')),
  ], { forbidPersistence: true })
}

if (mode === 'build' || mode === 'all') {
  const generatedFiles = [
    ...collectFiles(join(appRoot, '.next')),
    ...collectFiles(join(appRoot, '.vercel/output')),
    ...collectFiles(join(appRoot, 'out')),
  ]
  if (!generatedFiles.length) throw new Error('No generated Next.js output was found to scan.')
  scan(generatedFiles, { requireCanonicalTokens: true })
}

console.log(`Public demo privacy scan passed (${mode}).`)
