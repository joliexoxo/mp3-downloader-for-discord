FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PATH="/opt/yt-dlp/bin:${PATH}"
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 python3-venv \
    && python3 -m venv /opt/yt-dlp \
    && /opt/yt-dlp/bin/pip install --no-cache-dir 'yt-dlp[default]' \
    && ffmpeg -version && ffprobe -version \
    && rm -rf /var/lib/apt/lists/*
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src
RUN mkdir -p data downloads && chown node:node data downloads
USER node
CMD ["node", "src/index.js"]
