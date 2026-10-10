# Auth And Isolation Defaults

Default auth reuse:

1. create a setup project
2. authenticate once per role
3. store state
4. consume that state in dependent projects

Default rule:

- optimize away repeated login
- do not optimize away test isolation

When to keep login inside the test:

- the login journey is the actual subject
- permissions depend on fresh interactive auth behavior

Role strategy:

- one state per materially different role
- do not conflate “can sign in” with “same effective app surface”
