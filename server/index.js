import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: envFile });

const { createApp } = await import('./app.js');

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

async function start() {
  try {
    const { app } = await createApp();

    app.listen(PORT, HOST, () => {
      const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
      console.log(`[server] DefFinance disponível em http://${displayHost}:${PORT}`);
    });
  } catch (error) {
    console.error('[server] Falha ao iniciar', error);
    process.exit(1);
  }
}

start();
