# The site's small API: anonymous usage counts, feedback and the /admin dashboard (deploy/api/service.js).
# Node built-ins only, so there is no npm install. Build context is deploy/api:
#   docker compose -f deploy/docker-compose.yml up -d --build
FROM node:22-alpine
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
WORKDIR /app
COPY --chown=root:root . /app
# The node user (uid 1000) runs it; only /data (the bind mount of deploy/var) is written.
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('node:http').get({host:'127.0.0.1',port:process.env.PORT||8080,path:'/api/health'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
CMD ["node", "server.js"]
