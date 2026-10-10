# Network And API Defaults

Default synchronization order:

1. visible UI outcome
2. targeted network contract
3. route interception or API setup only when needed

Good reasons to mock:

- third-party volatility
- rare edge case coverage
- expensive or slow dependency paths

Bad reasons to mock:

- avoiding understanding the real flow
- hiding a flaky app contract
- bypassing broken locators

API setup is good when:

- it creates state faster
- it is not the product surface under test
- it keeps the UI test focused
