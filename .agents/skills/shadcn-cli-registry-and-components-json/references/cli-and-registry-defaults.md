# CLI And Registry Defaults

Default CLI posture:

1. initialize once
2. commit `components.json`
3. add only the components the app needs
4. review generated code like normal source code

`components.json` should stay stable for:

- style
- aliases
- icon library
- CSS variables mode
- Tailwind or CSS entrypoint

Registry default:

- official registry first
- private or custom registry only after you have a real reusable internal surface

Update default:

- do not expect generated code to remain identical to upstream
- review updates selectively
- treat local edits as intentional product code
