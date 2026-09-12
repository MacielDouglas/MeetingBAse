FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
RUN npm install --legacy-peer-deps --workspace=@meeting-base/api

# Copy source
COPY apps/api ./apps/api
COPY packages/db ./packages/db

# Build
WORKDIR /app/apps/api
RUN npm run typecheck

# Production
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api ./apps/api
COPY --from=base /app/packages/db ./packages/db

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "--import", "tsx", "src/index.ts"]
