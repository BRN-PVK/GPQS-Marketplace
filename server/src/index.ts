import { createApp } from './app.js';
import { env } from './env.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`API do Marketplace UFSCar rodando em http://localhost:${env.port}`);
});
