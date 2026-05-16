# ─────────────────────────────────────────────────────────────────────────────
# FlowZen — Multi-stage Dockerfile
# Stage 1: deps      — install all node_modules
# Stage 2: builder   — build the Next.js application
# Stage 3: runner    — minimal production image
# ─────────────────────────────────────────────────────────────────────────────

# ── Base image ────────────────────────────────────────────────────────────────
# Next.js 16 requires Node >= 20.9.0 (see package.json engines)
ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION} AS base

# Install libc compat for Alpine (needed by some native modules like sharp)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM base AS deps

# Copy package manifests only — lets Docker cache this layer until they change
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies needed for build)
# --legacy-peer-deps handles any peer resolution quirks in this project
RUN npm ci --legacy-peer-deps

# ── Stage 2: Build the application ───────────────────────────────────────────
FROM base AS builder

WORKDIR /app

# Bring in installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Next.js collects anonymous telemetry — disable it in CI/Docker builds
ENV NEXT_TELEMETRY_DISABLED=1

# Copy the public assets that the app reads at runtime (CSV files for ports/airports)
# These are already included in the COPY . . above, but we call this out explicitly
# in comments so operators know these files must be present.
# public/ports.csv and public/airports.csv must exist.

# Build the production Next.js bundle
# Environment variables that must be available at BUILD TIME are set here.
# Runtime secrets (API keys) are injected at container start via .env or --env-file.
RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner

# Install runtime dependencies for sharp (image optimisation used by Next.js)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy built output
# Next.js standalone mode bundles everything needed into .next/standalone
COPY --from=builder /app/public            ./public
COPY --from=builder /app/.next/standalone  ./
COPY --from=builder /app/.next/static      ./.next/static

# Fix ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose the default Next.js port
EXPOSE 3000

# Tell Node / Next.js where to listen
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Start the standalone server that Next.js generates
CMD ["node", "server.js"]
