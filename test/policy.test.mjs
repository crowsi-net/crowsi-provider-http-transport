import assert from 'node:assert/strict'
import test from 'node:test'
import { createProviderHttpTransport, ProviderTransportError } from '../src/index.mjs'

const origin = 'https://provider.example'
const code = expected => error => error instanceof ProviderTransportError && error.code === expected
test('rejects noncanonical origin policies and invalid bounds', () => {
  for (const allowedOrigins of [[], undefined, ['http://provider.example'], [origin + '/'], [origin + '/path'], ['https://user:password@provider.example'], [origin + ':443'], ['invalid']]) {
    assert.throws(() => createProviderHttpTransport({ allowedOrigins }), ProviderTransportError)
  }
  for (const field of ['maximumRequestBytes', 'maximumResponseBytes']) {
    for (const value of [0, -1, 1.5, Infinity, NaN, 16 * 1024 * 1024 + 1]) {
      assert.throws(() => createProviderHttpTransport({ allowedOrigins: [origin], [field]: value }), code('transport/options/limit/invalid'))
    }
    for (const value of [1, 16 * 1024 * 1024]) assert.ok(createProviderHttpTransport({ allowedOrigins: [origin], [field]: value }))
  }
  for (const timeoutMs of [0, -1, 1.5, 60001, Infinity]) assert.throws(() => createProviderHttpTransport({ allowedOrigins: [origin], timeoutMs }), code('transport/options/invalid'))
  for (const timeoutMs of [1, 60000]) assert.ok(createProviderHttpTransport({ allowedOrigins: [origin], timeoutMs }))
})

test('rejects unapproved schemes, origins, credentials, ports and fragments before fetch', async () => {
  let calls = 0
  const transport = createProviderHttpTransport({ allowedOrigins: [origin], fetchImplementation: async () => { calls++; return new Response() } })
  for (const url of ['http://provider.example', 'https://sub.provider.example', 'https://provider.example.other', 'https://provider.example:444', 'https://user:password@provider.example', origin + '/#secret', '/relative']) {
    await assert.rejects(transport.request({ url }), ProviderTransportError)
  }
  for (const method of ['HEAD', 'OPTIONS', 'TRACE', 'CONNECT']) await assert.rejects(transport.request({ url: origin, method }), code('transport/request/method/rejected'))
  for (const method of ['GET', 'DELETE']) await assert.rejects(transport.request({ url: origin, method, body: '' }), code('transport/request/body/rejected'))
  await assert.rejects(transport.request({ url: origin, method: 'POST', body: new FormData() }), code('transport/request/body/unbounded'))
  assert.equal(calls, 0)
})

test('counts UTF8, views, buffers, URLSearchParams and blobs by bytes', async () => {
  let calls = 0
  const transport = createProviderHttpTransport({ allowedOrigins: [origin], maximumRequestBytes: 4, fetchImplementation: async () => { calls++; return new Response('1234') } })
  for (const body of ['1234', new ArrayBuffer(4), new Uint8Array(4), new DataView(new ArrayBuffer(8), 2, 4), new URLSearchParams('a=12'), new Blob(['1234'])]) {
    assert.equal((await transport.request({ url: origin, method: 'POST', body })).status, 200)
  }
  for (const body of ['ああ', new ArrayBuffer(5), new Uint8Array(5), new Blob(['12345'])]) await assert.rejects(transport.request({ url: origin, method: 'POST', body }), code('transport/request/limit'))
  assert.equal(calls, 6)
})

test('accepts the exact response byte limit and rejects lying/invalid declared lengths', async () => {
  for (const declared of [null, '4']) {
    const transport = createProviderHttpTransport({ allowedOrigins: [origin], maximumResponseBytes: 4, fetchImplementation: async () => new Response('1234', { headers: declared === null ? {} : { 'content-length': declared } }) })
    assert.equal((await transport.request({ url: origin })).body.byteLength, 4)
  }
  for (const declared of ['-1', 'abc', '5']) {
    const transport = createProviderHttpTransport({ allowedOrigins: [origin], maximumResponseBytes: 4, fetchImplementation: async () => new Response('1234', { headers: { 'content-length': declared } }) })
    await assert.rejects(transport.request({ url: origin }), code('transport/response/limit'))
  }
  const lying = createProviderHttpTransport({ allowedOrigins: [origin], maximumResponseBytes: 4, fetchImplementation: async () => new Response('12345', { headers: { 'content-length': '1' } }) })
  await assert.rejects(lying.request({ url: origin }), code('transport/response/limit'))
})

test('forwards only caller supplied headers without returning request credentials', async () => {
  const headers = new Headers({ authorization: 'Bearer synthetic-fixture', 'x-fixture': 'sample' })
  const transport = createProviderHttpTransport({ allowedOrigins: [origin], fetchImplementation: async (_, init) => {
    assert.equal(new Headers(init.headers).get('authorization'), headers.get('authorization'))
    assert.equal(init.redirect, 'manual')
    return new Response('ok', { headers: { 'x-result': 'sample' } })
  } })
  const result = await transport.request({ url: origin, headers })
  assert.equal(headers.get('x-fixture'), 'sample')
  assert.equal(result.headers.get('authorization'), null)
  assert.equal(result.headers.get('x-result'), 'sample')
  assert.deepEqual(Object.keys(result).sort(), ['body', 'headers', 'status', 'statusText'])
})

test('rejects redirects and invalid response destinations while cancelling the body', async () => {
  for (const metadata of [{ status: 302 }, { type: 'opaqueredirect' }, { redirected: true }, { url: 'https://other.example' }, { url: origin + '/#fragment' }, { url: 'http://provider.example' }]) {
    let cancelled = 0
    const response = new Response(new ReadableStream({ cancel() { cancelled++ } }))
    for (const [key, value] of Object.entries(metadata)) Object.defineProperty(response, key, { value })
    const transport = createProviderHttpTransport({ allowedOrigins: [origin], fetchImplementation: async () => response })
    await assert.rejects(transport.request({ url: origin }), ProviderTransportError)
    assert.equal(cancelled, 1)
  }
})
