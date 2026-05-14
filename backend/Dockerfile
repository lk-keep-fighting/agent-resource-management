FROM nexus.aimstek.cn/node:20 AS base

FROM base AS deps
RUN npm install -g pnpm
WORKDIR /app
COPY backend/package.json backend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG NEXT_PUBLIC_SSO_URL
ARG NEXT_PUBLIC_SSO_REDIRECT_URI
ARG NEXT_PUBLIC_SSO_CLIENT_ID
ARG NEXT_PUBLIC_SSO_CLIENT_SECRET
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SSO_URL=$NEXT_PUBLIC_SSO_URL
ENV NEXT_PUBLIC_SSO_REDIRECT_URI=$NEXT_PUBLIC_SSO_REDIRECT_URI
ENV NEXT_PUBLIC_SSO_CLIENT_ID=$NEXT_PUBLIC_SSO_CLIENT_ID
ENV NEXT_PUBLIC_SSO_CLIENT_SECRET=$NEXT_PUBLIC_SSO_CLIENT_SECRET
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm install -g pnpm
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
RUN pnpm prisma generate
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN apt-get update && apt-get install -y zip && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
RUN mkdir -p /app/data/temp && chown nextjs:nodejs /app/data/temp
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]