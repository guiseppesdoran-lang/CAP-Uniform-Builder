'use strict';
// Entry point of the uniform-api container (deploy/api/Dockerfile). Settings come from the environment, which
// docker-compose fills from deploy/.env on the server (deploy/README.md):
//   ADMIN_PASSWORD   required for /admin; without it the dashboard answers 503 and this says why at start
//   SESSION_SECRET   optional; made at first start and kept in DATA_DIR/session-secret
//   DATA_DIR         where the events and feedback are kept (default /data, the bind mount of deploy/var)
//   TIMEZONE         the dashboard's days (default UTC), an IANA name such as America/New_York
//   PORT             default 8080; COOKIE_SECURE=0 only for a local test over plain HTTP
const { createService } = require('./service.js');

const env = process.env;
let svc;
try{
  svc = createService({
    dataDir: env.DATA_DIR || '/data',
    adminPassword: env.ADMIN_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || '',
    timezone: env.TIMEZONE || 'UTC',
    cookieSecure: env.COOKIE_SECURE !== '0'
  });
}catch(err){
  console.error(`[uniform-api] cannot start: ${err.message}`);
  process.exit(1);
}
const port = Number(env.PORT) || 8080;
const host = env.HOST || '0.0.0.0';
svc.server.listen(port, host, () => {
  const a = svc.server.address();
  console.log(`[uniform-api] listening on ${a.address}:${a.port}, data in ${svc.store.dir} (${svc.store.events.length} events, ${svc.store.feedback.length} feedback)`);
});
const stop = sig => { console.log(`[uniform-api] ${sig}, stopping`); svc.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
