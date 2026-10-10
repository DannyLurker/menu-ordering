# Token And Dark-Mode Defaults

Default theme stance:

- semantic tokens first
- CSS variables as the source of truth
- components inherit from tokens
- local overrides stay rare

Good baseline token groups:

- background and foreground
- card and popover
- primary and primary-foreground
- secondary and muted
- accent
- border, input, ring
- destructive

Dark-mode default:

1. choose one app-level dark-mode strategy
2. wire it early
3. validate contrast on surfaces, borders, and focus states
4. avoid per-component dark-mode improvisation

Use variants or local utility overrides only after the token layer has done its job.
