import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../http/AppError.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { authenticate, authorize } from '../../http/middleware/auth.js';
import { groupBySeller, lineSubtotalCents, purchasableCartItem, totalCents } from '../cart/cart.rules.js';
import { findCheckoutConflict } from './orders.rules.js';

export const ordersRouter = Router();
// Restrito a /orders: o router é montado em /api e não pode barrar rotas registradas depois dele.
ordersRouter.use('/orders', authenticate, authorize('BUYER'));

// C07 / RF06: cria um pedido único a partir do carrinho multivendedor.
// O preço vem sempre do banco; pagamento e baixa de estoque ficam para a etapa seguinte.
ordersRouter.post('/orders/checkout', asyncHandler(async (req, res) => {
  const order = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId: req.user!.sub },
      include: {
        // Mesmo filtro da exibição do carrinho: itens de produtos desativados não travam o checkout.
        items: {
          where: purchasableCartItem,
          include: { product: true },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });
    if (!cart || cart.items.length === 0) throw new AppError('O carrinho está vazio.', 400);

    const conflict = findCheckoutConflict(cart.items);
    if (conflict) {
      throw new AppError(`O produto "${conflict.product.name}" não está mais disponível na quantidade solicitada. Revise seu carrinho.`, 409);
    }

    const created = await tx.order.create({
      data: {
        buyerId: req.user!.sub,
        status: 'PENDING_PAYMENT',
        totalCents: totalCents(cart.items.map((item) => ({
          subtotalCents: lineSubtotalCents(item.product.priceCents, item.quantity),
        }))),
        items: {
          create: cart.items.map(({ product, quantity }) => ({
            productId: product.id,
            sellerId: product.sellerId,
            nameSnapshot: product.name,
            unitPriceCents: product.priceCents,
            quantity,
            fulfillmentStatus: 'CONFIRMED',
          })),
        },
      },
      include: {
        items: { include: { product: { include: { seller: { select: { storeName: true } } } } } },
      },
    });

    // Carrinho é limpo somente após a criação integral do pedido
    // (inclui itens ocultos de produtos que deixaram de estar disponíveis).
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  });

  res.status(201).json(toOrderResponse(order));
}));

// RF09: histórico dos pedidos do próprio comprador.
ordersRouter.get('/orders', asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { buyerId: req.user!.sub },
    include: {
      items: { include: { product: { include: { seller: { select: { storeName: true } } } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders.map(toOrderResponse));
}));

function toOrderResponse(order: {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  items: Array<{
    id: string;
    productId: string;
    sellerId: string;
    nameSnapshot: string;
    unitPriceCents: number;
    quantity: number;
    fulfillmentStatus: string;
    product: { seller: { storeName: string } };
  }>;
}) {
  // Valores vêm do registro da compra (preço e nome preservados), não do produto atual.
  const lines = order.items.map((item) => ({
    id: item.id, productId: item.productId, name: item.nameSnapshot,
    sellerId: item.sellerId, storeName: item.product.seller.storeName,
    unitPriceCents: item.unitPriceCents, quantity: item.quantity,
    subtotalCents: lineSubtotalCents(item.unitPriceCents, item.quantity),
    fulfillmentStatus: item.fulfillmentStatus,
  }));
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    groups: groupBySeller(lines),
  };
}
