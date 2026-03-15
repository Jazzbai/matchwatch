# ─── Stage 1: Install ─────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json turbo.json tsconfig.json ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/

RUN npm install --include=dev

COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# ─── Stage 2: Production ─────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/ ./

# Prune dev dependencies where possible
RUN npm prune --omit=dev 2>/dev/null || true
# Re-install tsx as it's needed to run TypeScript
RUN npm install tsx --no-save

USER appuser

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["npx", "tsx", "apps/api/src/index.ts"]
