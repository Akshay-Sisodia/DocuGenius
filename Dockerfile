# DocuGenius Dockerfile - Backend Only

FROM node:18-slim

WORKDIR /app

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && apt-get clean

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Create required directories
RUN mkdir -p logs temp

# Expose port for the server
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the Node.js server using index.js (with the ESM fix)
CMD ["node", "src/server/index.js"] 