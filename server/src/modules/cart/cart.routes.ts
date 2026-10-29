import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../http/AppError.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { authenticate, authorize } from '../../http/middleware/auth.js';
import { groupBySeller, lineSubtotalCents, purchasableCartItem, totalCents } from './cart.rules.js';

export const cartRouter = Router();

const addItemSchema = z.object({
  productId: z.string().min(1, 'Produto obrigatório.'),
  quantity: z.number().int().min(1).max(99).optional().default(1),
});
const quantitySchema = z.object({
  quantity: z.number().int().min(1, 'A quantidade deve ser pelo menos 1.').max(99),
});

// Todas as operações do carrinho são exclusivas de compradores autenticados.
// Restrito a /cart: o router é montado em /api e não pode barrar rotas registradas depois dele.
cartRouter.use('/cart', authenticate, authorize('BUYER'));

// GET /cart: itens agrupados por loja e totais calculados com preços do banco.
cartRouter.get(
  '/cart',
  asyncHandler(async (req, res) => {
    res.json(await readCart(req.user!.sub));
  }),
);

// POST /cart/items: adiciona ao carrinho (ou soma à quantidade existente).
cartRouter.post(
  '/cart/items',
  asyncHandler(async (req, res) => {
    const { productId, quantity } = addItemSchema.parse(req.body);
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: {
          id: productId,
          active: true,
          seller: { status: 'APPROVED' },
        },
      });
      if (!product) throw new AppError('Produto indisponível ou não encontrado.', 404);
      if (product.stockQty < 1) throw new AppError('Produto sem estoque.', 409);

      const cart = await tx.cart.upsert({
        where: { userId: req.user!.sub },
        create: { userId: req.user!.sub },
        update: {},
      });
      const existing = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } },
      });
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      if (nextQuantity > product.stockQty) {
        throw new AppError(`Estoque insuficiente. Disponível: ${product.stockQty}.`, 409);
      }
      if (existing) {
        await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
      } else {
        await tx.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
      }
    });
    res.status(201).json(await readCart(req.user!.sub));
  }),
);

// PATCH /cart/items/:itemId: define a quantidade do item, sem exceder o estoque.
cartRouter.patch(
  '/cart/items/:itemId',
  asyncHandler(async (req, res) => {
    const { quantity } = quantitySchema.parse(req.body);
    await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({ where: { userId: req.user!.sub } });
      if (!cart) throw new AppError('Item não encontrado no carrinho.', 404);
      const item = await tx.cartItem.findFirst({
        where: { id: req.params.itemId, cartId: cart.id },
        include: { product: { include: { seller: { select: { status: true } } } } },
      });
      if (!item) throw new AppError('Item não encontrado no carrinho.', 404);
      if (!item.product.active || item.product.seller.status !== 'APPROVED') {
        throw new AppError('Este produto não está mais disponível.', 409);
      }
      if (item.product.stockQty < quantity) {
        throw new AppError(`Estoque insuficiente. Disponível: ${item.product.stockQty}.`, 409);
      }
      await tx.cartItem.update({ where: { id: item.id }, data: { quantity } });
    });
    res.json(await readCart(req.user!.sub));
  }),
);

// DELETE /cart/items/:itemId: só permite remover itens do próprio comprador.
cartRouter.delete(
  '/cart/items/:itemId',
  asyncHandler(async (req, res) => {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user!.sub } });
    if (!cart) throw new AppError('Item não encontrado no carrinho.', 404);
    const item = await prisma.cartItem.findFirst({
      where: { id: req.params.itemId, cartId: cart.id },
      select: { id: true },
    });
    if (!item) throw new AppError('Item não encontrado no carrinho.', 404);
    await prisma.cartItem.delete({ where: { id: item.id } });
    res.json(await readCart(req.user!.sub));
  }),
);

async function readCart(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        where: purchasableCartItem,
        include: { product: { include: { seller: { select: { id: true, storeName: true } } } } },
        orderBy: { product: { name: 'asc' } },
      },
    },
  });

  const items = (cart?.items ?? []).map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.product.name,
    description: item.product.description,
    category: item.product.category,
    priceCents: item.product.priceCents,
    quantity: item.quantity,
    stockQty: item.product.stockQty,
    storeName: item.product.seller.storeName,
    sellerId: item.product.seller.id,
    subtotalCents: lineSubtotalCents(item.product.priceCents, item.quantity),
  }));

  return {
    id: cart?.id ?? null,
    groups: groupBySeller(items),
    itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: totalCents(items),
  };
}
