# Secret And Boundary Defaults

## Server-only by default

- private API keys
- signing keys
- admin credentials
- billing and permission decisions
- internal service-to-service trust

## Public only when intentionally designed that way

- publishable keys
- static feature metadata
- non-sensitive identifiers

## Never trust from the client

- role
- price
- tenant or ownership claims
- hidden form values
- local storage flags
