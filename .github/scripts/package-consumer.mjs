import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const archive = resolve(process.argv[2])
const root = mkdtempSync(join(tmpdir(), 'http-transport-consumer-'))
const env = { ...process.env, NPM_CONFIG_CACHE: join(root, 'empty-cache') }
for (const key of ['NPM_TOKEN', 'NODE_AUTH_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN']) delete env[key]
writeFileSync(join(root, '.npmrc'), '')
env.NPM_CONFIG_USERCONFIG = join(root, '.npmrc')
writeFileSync(
  join(root, 'package.json'),
  JSON.stringify({
    private: true,
    type: 'module',
    dependencies: { '@crowsi/provider-http-transport': `file:${archive}` },
    devDependencies: { typescript: '5.9.3' },
  }),
)
function run(command, args) {
  const p = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 300_000 })
  assert.equal(p.status, 0, `${command}: ${p.stdout?.slice(-4000)} ${p.stderr?.slice(-4000)}`)
}
run('npm', ['install', '--registry=https://registry.npmjs.org', '--ignore-scripts', '--no-fund'])
writeFileSync(
  join(root, 'smoke.mjs'),
  `
import assert from 'node:assert/strict'
import { createProviderHttpTransport, ProviderTransportError } from '@crowsi/provider-http-transport'
const transport = createProviderHttpTransport({ allowedOrigins: ['https://provider.example'], maximumResponseBytes: 4, fetchImplementation: async () => new Response('1234') })
const result = await transport.request({ url: 'https://provider.example/items' })
assert.equal(result.body.byteLength, 4)
assert.equal(new TextDecoder().decode(result.body), '1234')
await assert.rejects(transport.request({ url: 'https://other.example' }), error => error instanceof ProviderTransportError)
const stalled = createProviderHttpTransport({ allowedOrigins: ['https://provider.example'], timeoutMs: 5, fetchImplementation: async () => new Response(new ReadableStream()) })
await assert.rejects(stalled.request({ url: 'https://provider.example' }), error => error.code === 'transport/request/timeout')
`,
)
writeFileSync(
  join(root, 'smoke.mts'),
  `
import { createProviderHttpTransport, ProviderTransportError } from '@crowsi/provider-http-transport'
import type { ProviderHttpRequest, ProviderHttpResponse, ProviderHttpTransportOptions } from '@crowsi/provider-http-transport'
const options: ProviderHttpTransportOptions = { allowedOrigins: ['https://provider.example'] }
const request: ProviderHttpRequest = { url: new URL('https://provider.example'), headers: new Headers(), signal: new AbortController().signal }
const response: Promise<ProviderHttpResponse> = createProviderHttpTransport(options).request(request)
const failure: Error = new ProviderTransportError('transport/request/unavailable')
void response; void failure
// @ts-expect-error TRACE is outside the public method contract.
const wrong: ProviderHttpRequest = { url: 'https://provider.example', method: 'TRACE' }
void wrong
`,
)
run('node', ['smoke.mjs'])
run('node', [
  'node_modules/typescript/bin/tsc',
  '--noEmit',
  '--strict',
  '--target',
  'ES2022',
  '--module',
  'NodeNext',
  '--moduleResolution',
  'NodeNext',
  '--lib',
  'ES2022,DOM,DOM.Iterable',
  'smoke.mts',
])
run('npm', ['audit', '--json'])
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
for (const [name, item] of Object.entries(lock.packages)) {
  if (!name) continue
  if (name === 'node_modules/@crowsi/provider-http-transport')
    assert.equal(resolve(root, item.resolved.slice(5)), archive)
  else assert.ok(item.resolved.startsWith('https://registry.npmjs.org/'), `Non-public source: ${name}`)
}
console.log(
  JSON.stringify({
    root,
    archive,
    result: 'pass',
    runtime: true,
    installed_types: true,
    timeout: true,
    audit: true,
    other_dependencies_public_registry: true,
  }),
)
