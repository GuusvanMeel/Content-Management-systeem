FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# Test image: includes devDependencies (docker compose --profile test run --rm api-test)
FROM base AS test
ENV NODE_ENV=test
RUN npm ci
COPY . .
CMD ["npm", "test"]

# Production image (default target)
FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
