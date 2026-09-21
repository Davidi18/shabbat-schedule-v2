# Build the Vite PWA, then serve it (plus the content API) with a tiny Node server.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# The server runs the zmanim engine to archive special days, so it needs
# @hebcal/core at runtime — production dependencies only, from the lockfile.
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
COPY server.js dvar.js auth.js receipts.js archive.js archive-seed.json ./
COPY src/lib ./src/lib
ENV PORT=3000
ENV DATA_DIR=/data
EXPOSE 3000
CMD ["node", "server.js"]
