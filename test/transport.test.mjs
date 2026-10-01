import assert from 'node:assert/strict'
import test from 'node:test'
import { createProviderHttpTransport, ProviderTransportError } from '../src/index.mjs'

const origin = 'https://provider.example'

test('admits only the exact configured HTTPS origin and bounded methods', async () => {
  const calls = []
  const transport = createProviderHttpTransport({
    allowedOrigins: [origin],
    fetchImplementation: async (url, init) => {
      calls.push({ url, init })
      return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } })
    }
  })
  const result = await transport.request({ url: `${origin}/v1/items`, method: 'POST', body: '{}' })
  assert.equal(result.status, 200)
  assert.equal(new TextDecoder().decode(result.body), '{"ok":true}')
  assert.equal(calls[0].init.redirect, 'manual')
  await assert.rejects(transport.request({ url: 'https://other.example/v1/items' }), error =>
    error instanceof ProviderTransportError && error.code === 'transport/request/destination/rejected')
  await assert.rejects(transport.request({ url: `${origin}/v1/items`, method: 'TRACE' }), error =>
    error.code === 'transport/request/method/rejected')
  assert.equal(calls.length, 1)
})

test('rejects request and response bytes outside the configured bounds', async () => {
  const transport = createProviderHttpTransport({
    allowedOrigins: [origin], maximumRequestBytes: 4, maximumResponseBytes: 4,
    fetchImplementation: async () => new Response('12345')
  })
  await assert.rejects(transport.request({ url: `${origin}/`, method: 'POST', body: '12345' }), error =>
    error.code === 'transport/request/limit')
  await assert.rejects(transport.request({ url: `${origin}/` }), error =>
    error.code === 'transport/response/limit')
})

test('maps timeout and caller cancellation to distinct transport failures', async () => {
  const waitForAbort = (_url, { signal }) => new Promise((_, reject) =>
    signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  const timed = createProviderHttpTransport({ allowedOrigins: [origin], timeoutMs: 5, fetchImplementation: waitForAbort })
  await assert.rejects(timed.request({ url: `${origin}/` }), error => error.code === 'transport/request/timeout')

  const controller = new AbortController()
  const cancelled = createProviderHttpTransport({ allowedOrigins: [origin], fetchImplementation: waitForAbort })
  const pending = cancelled.request({ url: `${origin}/`, signal: controller.signal })
  controller.abort('caller')
  await assert.rejects(pending, error => error.code === 'transport/request/aborted')
})

test('keeps timeout and cancellation classification while reading a response body', async () => {
  const delayedResponse = () => {
    let timer
    return new Response(new ReadableStream({
      start(controller) {
        timer = setTimeout(() => {
          controller.enqueue(new TextEncoder().encode('late'))
          controller.close()
        }, 15)
      },
      cancel() { clearTimeout(timer) }
    }))
  }
  const timed = createProviderHttpTransport({
    allowedOrigins: [origin], timeoutMs: 5, fetchImplementation: delayedResponse
  })
  await assert.rejects(timed.request({ url: `${origin}/` }), error =>
    error.code === 'transport/request/timeout')

  const controller = new AbortController()
  const cancelled = createProviderHttpTransport({
    allowedOrigins: [origin], fetchImplementation: delayedResponse
  })
  const pending = cancelled.request({ url: `${origin}/`, signal: controller.signal })
  controller.abort('caller')
  await assert.rejects(pending, error => error.code === 'transport/request/aborted')
})

test('never follows a provider redirect with credentials attached', async () => {
  const transport = createProviderHttpTransport({
    allowedOrigins: [origin],
    fetchImplementation: async (_url, init) => {
      assert.equal(init.redirect, 'manual')
      return new Response(null, { status: 302, headers: { location: 'https://other.example/final' } })
    }
  })
  await assert.rejects(transport.request({ url: `${origin}/start` }), error =>
    error.code === 'transport/response/redirect/rejected')
})
