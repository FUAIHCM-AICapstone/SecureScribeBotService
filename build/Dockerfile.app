# Declare build argument at the top level
ARG RUNTIME_IMAGE=runtime:latest

# Build stage
FROM node:18 AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# Copy source code
COPY . .

# Build app
RUN npm ci && npm cache clean --force && npm run build

# Application stage - uses runtime base image
FROM ${RUNTIME_IMAGE}

WORKDIR /usr/src/app

# Copy built app and wrapper from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/xvfb-run-wrapper ./

# Copy node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy Chrome policy (run as root to ensure proper permissions)
USER root
RUN mkdir -p /etc/opt/chrome/policies/managed
COPY --chown=nodejs:nodejs auto_launch_protocols.json /etc/opt/chrome/policies/managed/auto_launch_protocols.json

# Process script
RUN dos2unix /usr/src/app/xvfb-run-wrapper && chmod +x /usr/src/app/xvfb-run-wrapper

# Switch back to nodejs user
USER nodejs

# Start app (xvfb-run optional, doesn't fail container if xvfb errors)
CMD bash -c "xvfb-run -a node dist/index.js || node dist/index.js"
