// Regras de validação do checkout (C07), pagamento/comissões (C08) e andamento dos itens (C09),
// isoladas para teste unitário.
import { calcCommissionCents } from '../products/products.rules.js';
import type { FulfillmentStatus } from '../../types.js';

export type CheckoutLine = {
  quantity: number;
  product: { name: string; priceCents: number; stockQty: number };
};

// CA07: retorna o primeiro item cuja quantidade excede o estoque (ou sem preço válido).
// A disponibilidade (produto ativo e vendedor aprovado) é filtrada na consulta,
// igual à exibição do carrinho, para o checkout considerar exatamente o que o comprador vê.
export function findCheckoutConflict<T extends CheckoutLine>(lines: T[]): T | undefined {
  return lines.find(({ quantity, product }) =>
    quantity < 1 || product.stockQty < quantity || product.priceCents <= 0,
  );
}

export interface OrderItemForCommission {
  sellerId: string;
  unitPriceCents: number;
  quantity: number;
}

export interface CalculatedCommission {
  sellerId: string;
  baseAmountCents: number;
  rateBps: number;
  amountCents: number;
  netAmountCents: number;
}

// CA08 (C08): Calcula a comissão retida pelo marketplace para cada vendedor do pedido.
// Agrupa os itens por vendedor, soma o subtotal e aplica a taxa em pontos-base (half-up).
export function calculateOrderCommissions(
  items: OrderItemForCommission[],
  rateBps: number,
): CalculatedCommission[] {
  const sellerTotals = new Map<string, number>();

  for (const item of items) {
    const lineSubtotal = item.unitPriceCents * item.quantity;
    sellerTotals.set(item.sellerId, (sellerTotals.get(item.sellerId) ?? 0) + lineSubtotal);
  }

  const commissions: CalculatedCommission[] = [];
  for (const [sellerId, baseAmountCents] of sellerTotals.entries()) {
    const amountCents = calcCommissionCents(baseAmountCents, rateBps);
    commissions.push({
      sellerId,
      baseAmountCents,
      rateBps,
      amountCents,
      netAmountCents: baseAmountCents - amountCents,
    });
  }

  return commissions;
}

export interface StockItem {
  id: string;
  stockQty: number;
}

export interface OrderItemForStock {
  productId: string;
  quantity: number;
}

// C08: Valida se todos os produtos têm estoque suficiente no momento do pagamento
export function validateStockAvailability(
  items: OrderItemForStock[],
  products: StockItem[],
): { valid: boolean; conflictProductId?: string } {
  const productMap = new Map(products.map((p) => [p.id, p.stockQty]));

  for (const item of items) {
    const currentStock = productMap.get(item.productId);
    if (currentStock === undefined || currentStock < item.quantity) {
      return { valid: false, conflictProductId: item.productId };
    }
  }

  return { valid: true };
}

// C09 / RF09: andamento dos itens de cada vendedor, na ordem definida no escopo
// (confirmado, em preparação, disponível para retirada e concluído).
export const FULFILLMENT_FLOW: readonly FulfillmentStatus[] = [
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
];

// Próximo estado do andamento, ou null quando já está concluído (ou o estado é desconhecido).
export function nextFulfillmentStatus(current: string): FulfillmentStatus | null {
  const index = FULFILLMENT_FLOW.indexOf(current as FulfillmentStatus);
  if (index < 0 || index === FULFILLMENT_FLOW.length - 1) return null;
  return FULFILLMENT_FLOW[index + 1];
}

// C09: o vendedor só avança o andamento de pedidos pagos, um estado por vez e sem voltar.
export function canAdvanceFulfillment(orderStatus: string, current: string, target: string): boolean {
  return orderStatus === 'CONFIRMED' && nextFulfillmentStatus(current) === target;
}

// Andamento da parte de um vendedor no pedido: o estado menos avançado entre os seus itens.
export function sellerPartStatus(statuses: string[]): FulfillmentStatus {
  const indexes = statuses.map((s) => FULFILLMENT_FLOW.indexOf(s as FulfillmentStatus)).filter((i) => i >= 0);
  return FULFILLMENT_FLOW[indexes.length ? Math.min(...indexes) : 0];
}
