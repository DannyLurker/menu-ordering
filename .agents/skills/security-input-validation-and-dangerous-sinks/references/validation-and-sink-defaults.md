# Validation And Sink Defaults

## Match the protection to the sink

- SQL -> parameterized queries
- HTML -> output-context escaping or sanitization
- shell -> no interpolation, structured args only
- filesystem -> fixed roots and allowlisted names
- redirect or URL fetch -> allowlists and scheme checks

## Default rule

If you cannot name the dangerous sink, you are probably validating too vaguely.
