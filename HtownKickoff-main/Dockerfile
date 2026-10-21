# ─── Stage 1: Build ──────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build-time env — API URL for client-side fetching + server-side proxy target
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
ARG API_PROXY_TARGET=http://api:4000
ARG NEXT_PUBLIC_APP_BASE_PATH=
ARG HIGHLIGHTS_STANDALONE=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV API_PROXY_TARGET=$API_PROXY_TARGET
ENV NEXT_PUBLIC_APP_BASE_PATH=$NEXT_PUBLIC_APP_BASE_PATH
ENV HIGHLIGHTS_STANDALONE=$HIGHLIGHTS_STANDALONE

RUN npm run build

# ─── Stage 2: Production ─────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache ffmpeg

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy standalone build + static/public assets
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appgroup /app/public ./public

# Next.js writes optimized image artifacts under .next/cache at runtime.
RUN mkdir -p /app/.next/cache && chown -R appuser:appgroup /app/.next

USER appuser

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV FFMPEG_PATH=/usr/bin/ffmpeg

EXPOSE 3000

CMD ["node", "server.js"]
