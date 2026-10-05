// Existing policy validation extracted without changing its public contract.
const MAXIMUM_BOUND = 16 * 1024 * 1024

export class ProviderTransportError extends Error {
  constructor(code, cause) {
    super(code, cause === undefined ? undefined : { cause })
    this.name = 'ProviderTransportError'
    this.code = code
  }
}

export function checkedLimit(value, fallback) {
  const selected = value ?? fallback
  if (!Number.isInteger(selected) || selected < 1 || selected > MAXIMUM_BOUND) {
    throw new ProviderTransportError('transport/options/limit/invalid')
  }
  return selected
}

export function checkedOrigins(values) {
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

export function checkedUrl(value, origins) {
  let url
  try { url = new URL(value) } catch (error) {
    throw new ProviderTransportError('transport/request/url/invalid', error)
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !origins.has(url.origin)) {
    throw new ProviderTransportError('transport/request/destination/rejected')
  }
  return url
}

export function bodySize(body) {
  if (body == null) return 0
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).byteLength
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size
  throw new ProviderTransportError('transport/request/body/unbounded')
}

