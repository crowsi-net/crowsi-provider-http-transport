import { ProviderTransportError } from './policy.mjs'

export function abortable(operation, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort)
    const abort = () => { cleanup(); reject(new ProviderTransportError('transport/request/aborted')) }
    Promise.resolve(operation).then(
      value => { cleanup(); resolve(value) },
      error => { cleanup(); reject(error) }
    )
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

export function cancelBody(response) {
  // Cleanup is best effort: an injected stream's cancel hook must not block the result.
  try { void response?.body?.cancel().catch(() => {}) } catch {}
}
