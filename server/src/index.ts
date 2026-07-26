import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';

async function main() {
  const { app } = await createApp();
  const server = createServer(app);
  server.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[server] shutting down after ${signal}`);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[server] failed to start', error);
  process.exit(1);
});
