import 'dotenv/config';
import { createApp } from './app.js';
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const { app } = createApp();
const server = app.listen(port, host, () =>
  console.log(`ChangeOrder running at http://${host}:${port} (PayPal sandbox)`),
);
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
