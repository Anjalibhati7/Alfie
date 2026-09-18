# syntax=docker/dockerfile:1

# Alfie agent service — Higgs Realtime proxy.
#
# Build context is services/agent, so this Dockerfile is self-contained: it does
# not reach into the workspace root. Deployed with:
#   npx -y insta@latest --agent deploy services/agent
#
# The service reads BOSON_API_KEY from the environment at runtime. It is never
# baked into the image, never written to a file, and never logged.

# ---- build ----------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Copy manifests first so the dependency layer is cached across source changes.
# The lockfile is optional here because this package is built standalone, outside
# the workspace root that owns the repository lockfile.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
# Matches the port the service and the mobile client expect.
ENV PORT=8080
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi \
    && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 8080

# The service writes nothing to disk, so it runs unprivileged.
USER node

CMD ["node", "dist/server.js"]
