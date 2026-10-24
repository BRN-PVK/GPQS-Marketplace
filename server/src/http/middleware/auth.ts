import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../../types.js';
import { AppError } from '../AppError.js';
import { verifyToken, type TokenPayload } from '../../utils/jwt.js';

// Anexa o usuário autenticado ao request.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// Exige um token válido (RF01: acesso conforme o perfil).
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Autenticação necessária.', 401);
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw new AppError('Token inválido ou expirado.', 401);
  }
}

// Exige que o usuário tenha um dos perfis informados.
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError('Autenticação necessária.', 401);
    if (!roles.includes(req.user.role)) {
      throw new AppError('Acesso negado para este perfil.', 403);
    }
    next();
  };
}
