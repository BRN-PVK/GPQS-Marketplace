import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../http/AppError.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signToken } from '../../utils/jwt.js';
import { authenticate } from '../../http/middleware/auth.js';
import type { Role } from '../../types.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Nome muito curto.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

// RF01: cadastro de comprador (perfil padrão BUYER).
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('E-mail já cadastrado.', 409);

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: 'BUYER' },
    });

    const token = signToken({ sub: user.id, role: user.role as Role, name: user.name });
    res.status(201).json({ token, user: publicUser(user) });
  }),
);

// RF01: autenticação.
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError('Credenciais inválidas.', 401);
    }

    const token = signToken({ sub: user.id, role: user.role as Role, name: user.name });
    res.json({ token, user: publicUser(user) });
  }),
);

// Dados do usuário autenticado + situação de vendedor (se houver).
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      include: { seller: true },
    });
    if (!user) throw new AppError('Usuário não encontrado.', 404);
    res.json({
      user: publicUser(user),
      seller: user.seller
        ? { id: user.seller.id, storeName: user.seller.storeName, status: user.seller.status }
        : null,
    });
  }),
);

function publicUser(user: { id: string; name: string; email: string; role: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
