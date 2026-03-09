# Build Stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache ffmpeg ttf-freefont

COPY package*.json ./
# Install production dependencies only
RUN npm install --omit=dev

# Install tsx globally or as a dependency to run server.ts
RUN npm install -g tsx

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./
COPY --from=build /app/src ./src

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["tsx", "server.ts"]
