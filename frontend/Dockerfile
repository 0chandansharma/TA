# Build stage
FROM node:18-alpine AS build

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install 'serve' to serve the build folder
RUN npm install -g serve

# Copy build output from previous stage
COPY --from=build /app/build ./build

ENV PORT 8080
EXPOSE 8080

# Serve the build folder
CMD ["serve", "-s", "build", "-l", "8080"]