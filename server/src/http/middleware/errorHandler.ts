import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../AppError.js';

// Tratamento centralizado de erros. Converte erros conhecidos em respostas JSON.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'Dados inválidos.',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}
