# Regression Checklist

## Ask these first

- Which scenario are we protecting?
- Which metric actually matters?
- Is this route, interaction, API, or background work?
- What is the acceptable regression budget?

## Always verify

- same scenario before and after
- same environment or a clearly stated delta
- correctness and side effects
- user-visible improvement, not just internal counters

## Default reporting

- improved / neutral / regressed
- metric used
- confidence level
- remaining uncertainty
