# @crowsi/provider-http-transport

Make browser HTTP requests within explicit origin, method, size and time limits.

## What you can do

- Enforce declared request and response bounds.
- Propagate cancellation and drain bounded responses.

## Current scope

The application supplies the approved egress policy. Arbitrary destinations and redirects are not silently accepted.

Package distribution is not activated by this documentation. Use the checked-in source and the declared dependency versions; published availability must be verified separately.

## Getting started

Use the package manager matching the checked-in lockfile and the Node.js version declared in `engines` in `package.json`. Run from this repository:

```sh
npm install
npm run test
```

## Documentation and source

[Usage guide](docs/getting-started.md)

[Implementation and public interfaces](src) · [Verification cases](test) · [Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md) · [License](LICENSE) · [Attribution notices](NOTICE)
