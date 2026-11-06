FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build \
    && npm prune --omit=dev \
    && mkdir -p /var/data \
    && chown -R node:node /app /var/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/var/data/rise1.sqlite

USER node
EXPOSE 3001
CMD ["npm", "start"]
