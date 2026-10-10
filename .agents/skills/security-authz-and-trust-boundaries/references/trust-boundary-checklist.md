# Trust Boundary Checklist

## Always identify

- who is the actor
- what resource is being touched
- which action is happening
- what server-side fact proves the actor is allowed

## Default checks

- session is valid
- actor belongs to the tenant or org
- actor owns the resource or has explicit privilege
- resource lookup is constrained by tenant or owner where appropriate

## Smells

- `if (isAdmin)` with no resource check
- client sends `userId` and server trusts it
- UI hides buttons but backend allows the mutation
