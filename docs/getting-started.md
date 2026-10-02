# Using @crowsi/provider-http-transport

Make browser HTTP requests within explicit origin, method, size and time limits.

## Before you start

The application supplies the approved egress policy. Arbitrary destinations and redirects are not silently accepted.

## First steps

Run from the repository root:

```sh
npm install
npm run test
```

## How to assess the result

- Enforce declared request and response bounds.
- Propagate cancellation and drain bounded responses.

A passing source-level check establishes only what that check observes. Keep missing configuration, unavailable services and unverified deployment paths visible.

## Continue reading

[Repository overview](../README.md)
