FROM --platform=linux/amd64 node:24-bookworm-slim

ENV NODE_ENV=production
ENV PORT=5001
ENV RUN_MAINTENANCE_JOBS=false

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/src ./src

EXPOSE 5001

CMD ["node", "src/server.js"]
