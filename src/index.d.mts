export interface ProviderHttpRequest {
  url: string | URL
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  headers?: HeadersInit
  body?: BodyInit | null
  signal?: AbortSignal
}

export interface ProviderHttpResponse {
  status: number
  statusText: string
  headers: Headers
  body: Uint8Array
}

export interface ProviderHttpTransportOptions {
  allowedOrigins: string[]
  maximumRequestBytes?: number
  maximumResponseBytes?: number
  timeoutMs?: number
  fetchImplementation?: typeof fetch
}

export class ProviderTransportError extends Error {
  readonly code: string
  constructor(code: string, cause?: unknown)
}

export function createProviderHttpTransport(options: ProviderHttpTransportOptions): {
  request(request: ProviderHttpRequest): Promise<ProviderHttpResponse>
}
