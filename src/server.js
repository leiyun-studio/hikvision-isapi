import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';

async function start() {
  const config = loadConfig();
  const app = buildApp({ logger: true });

  const shutdown = async () => {
    try {
      await app.close();
    } catch (error) {
      app.log.error(error);
      process.exitCode = 1;
    }
  };
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, shutdown);
  await app.listen(config.server);
}

start().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
