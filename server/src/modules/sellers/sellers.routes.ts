import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../http/AppError.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { authenticate, authorize } from '../../http/middleware/auth.js';

export const sellersRouter = Router();

const requestSchema = z.object({
  storeName: z.string().min(2, 'Nome da loja muito curto.'),
});

// RF02: usuário solicita virar vendedor. Cria perfil PENDING e eleva papel para SELLER.
// A publicação só é liberada após aprovação (CA01) - papel SELLER + status APPROVED.
sellersRouter.post(
  '/sellers/request',
  authenticate,
  asyncHandler(async (req, res) => {
    const { storeName } = requestSchema.parse(req.body);
    const userId = req.user!.sub;

    if (req.user!.role === 'ADMIN') {
      throw new AppError('Administrador não pode se cadastrar como vendedor.', 403);
    }

    const existing = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (existing) throw new AppError('Solicitação de vendedor já existente.', 409);

    const seller = await prisma.$transaction(async (tx) => {
      const created = await tx.sellerProfile.create({
        data: { userId, storeName, status: 'PENDING' },
      });
      await tx.user.update({ where: { id: userId }, data: { role: 'SELLER' } });
      return created;
    });

    res.status(201).json({
      id: seller.id,
      storeName: seller.storeName,
      status: seller.status,
    });
  }),
);

// RF02: vendedor edita seus dados básicos (nome da loja).
sellersRouter.patch(
  '/sellers/me',
  authenticate,
  authorize('SELLER'),
  asyncHandler(async (req, res) => {
    const { storeName } = requestSchema.parse(req.body);
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: req.user!.sub } });
    if (!seller) throw new AppError('Perfil de vendedor não encontrado.', 404);

    const updated = await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { storeName },
    });
    res.json({ id: updated.id, storeName: updated.storeName, status: updated.status });
  }),
);

// RF02 (admin): listar solicitações de vendedores, opcionalmente por status.
sellersRouter.get(
  '/admin/sellers',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const statusParam = req.query.status;
    const where =
      statusParam === 'PENDING' || statusParam === 'APPROVED' || statusParam === 'REJECTED'
        ? { status: statusParam }
        : {};

    const sellers = await prisma.sellerProfile.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      sellers.map((s) => ({
        id: s.id,
        storeName: s.storeName,
        status: s.status,
        user: s.user,
        createdAt: s.createdAt,
      })),
    );
  }),
);

// RF02 (admin): aprovar vendedor (CA01).
sellersRouter.post(
  '/admin/sellers/:id/approve',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const seller = await updateStatus(req.params.id, 'APPROVED');
    res.json(seller);
  }),
);

// RF02 (admin): rejeitar vendedor.
sellersRouter.post(
  '/admin/sellers/:id/reject',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const seller = await updateStatus(req.params.id, 'REJECTED');
    res.json(seller);
  }),
);

async function updateStatus(id: string, status: 'APPROVED' | 'REJECTED') {
  const existing = await prisma.sellerProfile.findUnique({ where: { id } });
  if (!existing) throw new AppError('Vendedor não encontrado.', 404);
  const updated = await prisma.sellerProfile.update({ where: { id }, data: { status } });
  return { id: updated.id, storeName: updated.storeName, status: updated.status };
}
