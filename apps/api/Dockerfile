# Build stage
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile=false --filter @norte/api...
RUN pnpm --filter @norte/api build

# Runtime
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY packages/contracts ./packages/contracts
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile=false --filter @norte/api... --prod
COPY --from=build /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
