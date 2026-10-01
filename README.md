# Crowsi provider HTTP transport

Version 0.10.0. This package performs bounded browser HTTP egress for provider
adapters. It owns transport safety only: exact-origin admission, method admission,
request and response byte limits, deadlines, cancellation, and response draining.

The provider adapter owns endpoint paths, authorization headers, provider scopes,
response schemas, pagination, retries and application errors. The product UI does
not call this package directly. The transport never reads credentials, chooses a
provider, follows an alternate origin, parses business JSON, or retries effects.

Every destination origin is supplied explicitly by the provider adapter. HTTPS is
required; URL credentials and fragments are rejected. Redirects are not followed:
the provider owner must admit a changed endpoint explicitly before any credential
can be sent to it.

Run `npm test` to verify origin, size, deadline, cancellation and response bounds.
