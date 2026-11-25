FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV UPLOADS_DIR=/data/uploads

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --omit=dev
COPY backend/src ./backend/src
COPY backend/database ./backend/database
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 4000
CMD ["node", "backend/src/server.js"]
