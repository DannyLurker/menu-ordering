FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /srv/app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /srv/app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate && pnpm build

FROM base AS runner
ENV NODE_ENV=production PORT=3000
RUN useradd -m appuser
COPY --from=build /srv/app/node_modules ./node_modules
COPY --from=build /srv/app/.next ./.next
COPY --from=build /srv/app/public ./public
COPY --from=build /srv/app/package.json ./package.json
COPY --from=build /srv/app/server.ts ./server.ts
COPY --from=build /srv/app/prisma ./prisma
COPY --from=build /srv/app/generated ./generated
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh
USER appuser
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
