# Dockerfile
# Multi-stage build for Next.js 14 Sales CRM
# Designed for EasyPanel deployment with output: 'standalone'
#
# EasyPanel environment variables required:
#   NEXT_PUBLIC_SUPABASE_URL       - Internal URL of Supabase within EasyPanel network
#   NEXT_PUBLIC_SUPABASE_ANON_KEY  - Anon/public key from Supabase
#   SUPABASE_SERVICE_ROLE_KEY      - Service role key (for admin scripts only)
#
# EasyPanel deployment notes:
#   - Supabase self-hosted should be a separate service with PGTZ=UTC on the PostgreSQL container
#   - Kong rate-limiting plugin should be configured on the /auth/v1/token route

# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN mkdir -p /app/public
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
