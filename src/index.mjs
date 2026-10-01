const METHODS = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
const MAXIMUM_BOUND = 16 * 1024 * 1024

export class ProviderTransportError extends Error {
  constructor(code, cause) {
    super(code, cause === undefined ? undefined : { cause })
    this.name = 'ProviderTransportError'
    this.code = code
  }
}

function checkedLimit(value, fallback) {
  const selected = value ?? fallback
  if (!Number.isInteger(selected) || selected < 1 || selected > MAXIMUM_BOUND) {
    throw new ProviderTransportError('transport/options/limit/invalid')
  }
  return selected
}

function checkedOrigins(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ProviderTransportError('transport/options/origins/empty')
  }
  return new Set(values.map(value => {
    let url
    try { url = new URL(value) } catch (error) {
      throw new ProviderTransportError('transport/options/origin/invalid', error)
    }
    if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) {
      throw new ProviderTransportError('transport/options/origin/invalid')
    }
    return url.origin
  }))
}

function checkedUrl(value, origins) {
  let url
  try { url = new URL(value) } catch (error) {
    throw new ProviderTransportError('transport/request/url/invalid', error)
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !origins.has(url.origin)) {
    throw new ProviderTransportError('transport/request/destination/rejected')
  }
  return url
}

function bodySize(body) {
  if (body == null) return 0
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).byteLength
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size
  throw new ProviderTransportError('transport/request/body/unbounded')
}

async function readBounded(response, maximumBytes, signal) {
  const declared = response.headers.get('content-length')
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > maximumBytes)) {
    await response.body?.cancel().catch(() => {})
    throw new ProviderTransportError('transport/response/limit')
  }
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const parts = []
  let size = 0
  try {
    while (true) {
      if (signal.aborted) throw new ProviderTransportError('transport/request/aborted')
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > maximumBytes) throw new ProviderTransportError('transport/response/limit')
      parts.push(part.value)
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.byteLength
  }
  return bytes
}

export function createProviderHttpTransport({
  allowedOrigins,
  maximumRequestBytes,
  maximumResponseBytes,
  timeoutMs = 15000,
  fetchImplementation = globalThis.fetch
} = {}) {
  const origins = checkedOrigins(allowedOrigins)
  const requestLimit = checkedLimit(maximumRequestBytes, 64 * 1024)
  const responseLimit = checkedLimit(maximumResponseBytes, 1024 * 1024)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || typeof fetchImplementation !== 'function') {
    throw new ProviderTransportError('transport/options/invalid')
  }

  return Object.freeze({
    async request({ url: input, method = 'GET', headers, body = null, signal } = {}) {
      const url = checkedUrl(input, origins)
      const normalizedMethod = String(method).toUpperCase()
      if (!METHODS.has(normalizedMethod)) throw new ProviderTransportError('transport/request/method/rejected')
      if ((normalizedMethod === 'GET' || normalizedMethod === 'DELETE') && body != null) {
        throw new ProviderTransportError('transport/request/body/rejected')
      }
      if (bodySize(body) > requestLimit) throw new ProviderTransportError('transport/request/limit')

      const controller = new AbortController()
      const abort = () => controller.abort(signal?.reason)
      if (signal?.aborted) abort()
      else signal?.addEventListener('abort', abort, { once: true })
      const timer = setTimeout(() => controller.abort('transport/timeout'), timeoutMs)
      try {
        let response
        try {
          response = await fetchImplementation(url.href, {
            method: normalizedMethod,
            headers,
            body,
            signal: controller.signal,
            // Redirects are never followed with provider credentials attached.
            // The provider owner must admit a new exact endpoint explicitly.
            redirect: 'manual'
          })
        } catch (error) {
          if (controller.signal.aborted) {
            throw new ProviderTransportError(controller.signal.reason === 'transport/timeout'
              ? 'transport/request/timeout' : 'transport/request/aborted', error)
          }
          throw new ProviderTransportError('transport/request/unavailable', error)
        }
        if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
          await response.body?.cancel().catch(() => {})
          throw new ProviderTransportError('transport/response/redirect/rejected')
        }
        const finalUrl = checkedUrl(response.url || url.href, origins)
        if (finalUrl.origin !== url.origin) {
          await response.body?.cancel().catch(() => {})
          throw new ProviderTransportError('transport/response/redirect/rejected')
        }
        let responseBody
        try {
          responseBody = await readBounded(response, responseLimit, controller.signal)
        } catch (error) {
          if (controller.signal.aborted) {
            throw new ProviderTransportError(controller.signal.reason === 'transport/timeout'
              ? 'transport/request/timeout' : 'transport/request/aborted', error)
          }
          throw error
        }
        return Object.freeze({
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
          body: responseBody
        })
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
      }
    }
  })
}
