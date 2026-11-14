import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../../types.js';
import { AppError } from '../AppError.js';
import { asyncHandler } from '../asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
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
// C09: o perfil vem do banco, não do token, para que mudanças (comprador que vira vendedor)
// valham sem novo login e um token antigo não mantenha um perfil que o usuário já não tem.
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Autenticação necessária.', 401);
  }
  const token = header.slice('Bearer '.length).trim();
  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError('Token inválido ou expirado.', 401);
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { role: true, name: true },
  });
  if (!user) throw new AppError('Token inválido ou expirado.', 401);
  req.user = { ...payload, role: user.role as Role, name: user.name };
  next();
});

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
