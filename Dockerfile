FROM node:22-bookworm-slim AS build

WORKDIR /app

# better-sqlite3 needs a build toolchain during install.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json

RUN npm ci

COPY . .

RUN npm run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/server ./server
COPY --from=build /app/web/dist ./web/dist

EXPOSE 3000

CMD ["node", "server/dist/index.js"]
