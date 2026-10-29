FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs app.mjs ./
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node","server.mjs"]
