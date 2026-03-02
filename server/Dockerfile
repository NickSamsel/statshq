FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy application code
COPY index.js ./

# Create directory for credentials (will be mounted as volume)
RUN mkdir -p /app/credentials

# Copy and setup credentials script
COPY setup-credentials-docker.sh /tmp/setup-credentials.sh
RUN chmod +x /tmp/setup-credentials.sh

# Expose port
EXPOSE 8080

# Set environment variable for production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Setup credentials and start the server
CMD ["/bin/sh", "-c", "/tmp/setup-credentials.sh && node index.js"]
