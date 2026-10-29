# Multi-stage build: compile TypeScript, then ship only production dependencies.

# Node's IPv4/IPv6 auto-selection can time out on some networks, which makes npm crash
# mid-install ("Exit handler never called!") while still exiting with code 0.
# These flags are applied only to the install steps, and each install is verified afterwards.
ARG NPM_NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"

FROM node:20-alpine AS build
ARG NPM_NODE_OPTIONS
WORKDIR /app
COPY package*.json ./
RUN NODE_OPTIONS="$NPM_NODE_OPTIONS" npm ci --no-audit --no-fund --fetch-retries=5 \
  && test -x node_modules/.bin/nest
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && test -f dist/main.js

FROM node:20-alpine AS runtime
ARG NPM_NODE_OPTIONS
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN NODE_OPTIONS="$NPM_NODE_OPTIONS" npm ci --omit=dev --no-audit --no-fund --fetch-retries=5 \
  && test -x node_modules/.bin/typeorm \
  && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# Apply reviewed migrations before starting the API.
CMD ["sh", "-c", "npm run migration:run:prod && node dist/main.js"]
