# Declare build argument at the top level
ARG RUNTIME_IMAGE=runtime:latest

# Build stage
FROM node:18 AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# Install dependencies and Playwright
RUN npm ci && npm cache clean --force && \
  npx playwright install --with-deps

# Copy source code
COPY . .

# Build app
RUN npm run build

# Application stage - uses runtime base image
FROM ${RUNTIME_IMAGE}

WORKDIR /usr/src/app

# Copy package files from builder
COPY --from=builder /usr/src/app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built app and wrapper from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/xvfb-run-wrapper ./

# Copy Chrome policy
COPY --chown=nodejs:nodejs auto_launch_protocols.json /etc/opt/chrome/policies/managed/auto_launch_protocols.json

# Create temp video directory with proper permissions
RUN mkdir -p /usr/src/app/dist/_tempvideo && chmod -R 777 /usr/src/app/dist/_tempvideo

# Process script
RUN dos2unix /usr/src/app/xvfb-run-wrapper && chmod +x /usr/src/app/xvfb-run-wrapper

# Start app (xvfb-run optional, doesn't fail container if xvfb errors)
CMD bash -c "xvfb-run -a node dist/index.js || node dist/index.js"
