# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
# Prisma's engines need OpenSSL, which node:alpine doesn't ship.
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# Heap headroom for tsc on small (1GB + swap) build hosts.
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN npx prisma generate && npm run build

# ─── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
# The marketing site is served from public/ at / (see main.ts).
COPY --from=build /app/public ./public
EXPOSE 3000
# Apply migrations then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
