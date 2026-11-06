// Regras de validação do checkout (C07) e pagamento/comissões (C08), isoladas para teste unitário.
import { calcCommissionCents } from '../products/products.rules.js';

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

