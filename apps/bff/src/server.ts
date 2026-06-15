import { buildApp } from './app.js';
import { env } from './env.js';

const app = buildApp();

process.on('uncaughtException', (error) => {
  console.error('[bff] uncaughtException', {
    error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack ?? null : null
  });
  app.log.fatal({ err: error }, 'uncaught exception in BFF process');
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  console.error('[bff] unhandledRejection', {
    reason,
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack ?? null : null
  });
  app.log.fatal({ err: reason }, 'unhandled rejection in BFF process');
  process.exitCode = 1;
});

process.on('exit', (code) => {
  console.error('[bff] process exit', { code });
});

await app.listen({
  port: env.port,
  host: env.host
});
