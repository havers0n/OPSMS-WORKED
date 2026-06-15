import { buildApp } from './app.js';
import { env } from './env.js';

const app = buildApp();

process.on('uncaughtException', (error) => {
  app.log.fatal({ err: error }, 'uncaught exception in BFF process');
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  app.log.fatal({ err: reason }, 'unhandled rejection in BFF process');
  process.exitCode = 1;
});

await app.listen({
  port: env.port,
  host: env.host
});
