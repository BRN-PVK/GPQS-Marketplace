import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { sellersRouter } from './modules/sellers/sellers.routes.js';
import { errorHandler } from './http/middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Rotas da API
  app.use('/api/auth', authRouter);
  app.use('/api', sellersRouter);

  // 404 para rotas não mapeadas
  app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

  // Tratamento de erros (deve ser o último middleware)
  app.use(errorHandler);

  return app;
}
