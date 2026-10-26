FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY config ./config
COPY src ./src
COPY scripts ./scripts
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
EXPOSE 8080
CMD ["node", "src/server.js"]
