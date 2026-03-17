FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm install

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove dev dependencies for production image
RUN npm prune --production

EXPOSE 3000

CMD ["node", "dist/server.js"]
