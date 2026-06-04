# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Create required directories
RUN mkdir -p uploads vector_stores logs

EXPOSE 5000

CMD ["node", "server.js"]
