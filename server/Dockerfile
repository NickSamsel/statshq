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

# Expose port
EXPOSE 8080

# Set environment variable for production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start the server
CMD ["node", "index.js"]
