# Default Review Map

## Start here

- What input can an attacker control?
- What action changes privileged state?
- What secret or sensitive data exists?
- What boundary is assumed trusted but probably is not?

## Most common top risks in app code

1. trusting the client too much
2. server-side authz checks missing or inconsistent
3. untrusted input reaching a dangerous sink
4. secrets or privileged tokens leaking to the browser

## Default rule

Find the strongest exploit path first, not the longest checklist.
