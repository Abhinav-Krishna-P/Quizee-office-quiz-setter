# Use a lightweight official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files (source code, SQL schema, etc.)
COPY src/ ./src/

# Expose server port (configured in sessions.js / index.js)
EXPOSE 4000

# Set environment defaults
ENV PORT=4000
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "src/index.js"]
