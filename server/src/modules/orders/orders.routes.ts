import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../env.js';
import { AppError } from '../../http/AppError.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { authenticate, authorize } from '../../http/middleware/auth.js';
import { groupBySeller, lineSubtotalCents, purchasableCartItem, totalCents } from '../cart/cart.rules.js';
import {
  findCheckoutConflict,
  calculateOrderCommissions,
  validateStockAvailability,
} from './orders.rules.js';

export const ordersRouter = Router();

// C08: Vendas e comissões da loja do vendedor autenticado
ordersRouter.get(
  '/seller/orders',
  authenticate,
  authorize('SELLER'),
  asyncHandler(async (req, res) => {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: req.user!.sub },
    });
    if (!seller) throw new AppError('Perfil de vendedor não encontrado.', 404);

    const orderItems = await prisma.orderItem.findMany({
      where: { sellerId: seller.id },
      include: {
        order: {
          include: {
            payment: true,
            buyer: { select: { name: true, email: true } },
            commissions: { where: { sellerId: seller.id } },
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });

    const ordersMap = new Map<
      string,
      {
        orderId: string;
        orderStatus: string;
        createdAt: Date;
        payment: { id: string; result: string; createdAt: Date } | null;
        buyer: { name: string; email: string };
        commission: {
          baseAmountCents: number;
          rateBps: number;
          amountCents: number;
          netAmountCents: number;
        } | null;
        items: Array<{
          id: string;
          name: string;
          unitPriceCents: number;
          quantity: number;
          subtotalCents: number;
        }>;
        subtotalCents: number;
      }
    >();

    for (const item of orderItems) {
      let orderEntry = ordersMap.get(item.orderId);
      if (!orderEntry) {
        const commission = item.order.commissions[0];
        orderEntry = {
          orderId: item.order.id,
          orderStatus: item.order.status,
          createdAt: item.order.createdAt,
          payment: item.order.payment,
          buyer: item.order.buyer,
          commission: commission
            ? {
                baseAmountCents: commission.baseAmountCents,
                rateBps: commission.rateBps,
                amountCents: commission.amountCents,
                netAmountCents: commission.baseAmountCents - commission.amountCents,
              }
            : null,
          items: [],
          subtotalCents: 0,
        };
        ordersMap.set(item.orderId, orderEntry);
      }
      const lineSubtotal = lineSubtotalCents(item.unitPriceCents, item.quantity);
      orderEntry.items.push({
        id: item.id,
        name: item.nameSnapshot,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        subtotalCents: lineSubtotal,
      });
      orderEntry.subtotalCents += lineSubtotal;
    }

    const sales = [...ordersMap.values()];
    const confirmedSales = sales.filter((s) => s.orderStatus === 'CONFIRMED');
    const totalGrossCents = confirmedSales.reduce((sum, s) => sum + s.subtotalCents, 0);
    const totalCommissionCents = confirmedSales.reduce(
      (sum, s) => sum + (s.commission?.amountCents ?? 0),
      0,
    );
    const totalNetCents = totalGrossCents - totalCommissionCents;

    res.json({
      storeName: seller.storeName,
      summary: {
        totalGrossCents,
        totalCommissionCents,
        totalNetCents,
        confirmedOrdersCount: confirmedSales.length,
      },
      sales,
    });
  }),
);

// Restrito a /orders: o router é montado em /api e não pode barrar rotas registradas depois dele.
ordersRouter.use('/orders', authenticate, authorize('BUYER'));

// C07 / RF06: cria um pedido único a partir do carrinho multivendedor.
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
        payment: true,
        items: { include: { product: { include: { seller: { select: { storeName: true } } } } } },
      },
    });

    // Carrinho é limpo somente após a criação integral do pedido
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  });

  res.status(201).json(toOrderResponse(order));
}));

// C08 / RF07 / RF08: Simulação de pagamento, baixa atômica de estoque e cálculo de comissões.
ordersRouter.post('/orders/:id/pay', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const bodySchema = z.object({
    result: z.enum(['APPROVED', 'REJECTED']).optional().default('APPROVED'),
  });
  const parseResult = bodySchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    throw new AppError('Resultado de pagamento inválido. Deve ser APPROVED ou REJECTED.', 400);
  }
  const paymentResult = parseResult.data.result;

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payment: true,
    },
  });

  if (!existingOrder || existingOrder.buyerId !== req.user!.sub) {
    throw new AppError('Pedido não encontrado.', 404);
  }

  if (existingOrder.status !== 'PENDING_PAYMENT' || existingOrder.payment) {
    throw new AppError('Este pedido não está aguardando pagamento.', 400);
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    if (paymentResult === 'APPROVED') {
      // 1. Validar disponibilidade do estoque atual de todos os itens do pedido
      const productIds = existingOrder.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stockQty: true, name: true },
      });

      const stockCheck = validateStockAvailability(
        existingOrder.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        products,
      );

      if (!stockCheck.valid) {
        const conflict = products.find((p) => p.id === stockCheck.conflictProductId);
        throw new AppError(
          `Estoque insuficiente para o produto "${conflict?.name ?? 'desconhecido'}". Pagamento não aprovado.`,
          409,
        );
      }

      // 2. Baixar o estoque de cada produto adquirido
      for (const item of existingOrder.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }

      // 3. Calcular e registrar comissões por vendedor (CA08)
      const calculatedCommissions = calculateOrderCommissions(
        existingOrder.items.map((i) => ({
          sellerId: i.sellerId,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
        })),
        env.commissionRateBps,
      );

      for (const comm of calculatedCommissions) {
        await tx.commission.create({
          data: {
            orderId: existingOrder.id,
            sellerId: comm.sellerId,
            baseAmountCents: comm.baseAmountCents,
            rateBps: comm.rateBps,
            amountCents: comm.amountCents,
          },
        });
      }

      // 4. Registrar o pagamento aprovado
      await tx.payment.create({
        data: {
          orderId: existingOrder.id,
          result: 'APPROVED',
        },
      });

      // 5. Confirmar o pedido
      return await tx.order.update({
        where: { id: existingOrder.id },
        data: { status: 'CONFIRMED' },
        include: {
          payment: true,
          items: { include: { product: { include: { seller: { select: { storeName: true } } } } } },
        },
      });
    } else {
      // Pagamento REJEITADO: sem baixa de estoque e sem comissão
      await tx.payment.create({
        data: {
          orderId: existingOrder.id,
          result: 'REJECTED',
        },
      });

      return await tx.order.update({
        where: { id: existingOrder.id },
        data: { status: 'REJECTED' },
        include: {
          payment: true,
          items: { include: { product: { include: { seller: { select: { storeName: true } } } } } },
        },
      });
    }
  });

  res.json(toOrderResponse(updatedOrder));
}));

// RF09: histórico dos pedidos do próprio comprador.
ordersRouter.get('/orders', asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { buyerId: req.user!.sub },
    include: {
      payment: true,
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
  payment?: { id: string; result: string; createdAt: Date } | null;
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
    payment: order.payment
      ? {
          id: order.payment.id,
          result: order.payment.result,
          createdAt: order.payment.createdAt,
        }
      : null,
    groups: groupBySeller(lines),
  };
}

