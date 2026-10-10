# Verify: stack and architecture · spec 0001 · updated 2026-10-10

_Steps derived from scope feature 1 Done when. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] `docker compose up --build -d`, open `http://localhost:3000` → expect 200, `docker compose ps` shows `db` healthy → docker boot

## Commands

- [x] `docker compose up --build -d` → expect app 200 plus db healthy → docker boot
- [x] `pnpm build` → expect pass → build green
- [x] `pnpm prisma validate` → expect valid → skeleton sound
- [x] `docker compose config --quiet` → expect clean → compose sound

## Acceptance-criteria coverage

- Runs locally in docker → covered by docker boot step · Empty app boots and passes build → covered by build step · Stack choice recorded in a spec → `docs/specs/0001-stack-and-architecture/index.md` exists
