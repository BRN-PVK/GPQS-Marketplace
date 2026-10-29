// Regras centrais de cálculo do carrinho e do pedido (C06/C07), isoladas para teste unitário.
// Valores sempre em centavos (Int).
import type { Prisma } from '@prisma/client';

// Itens que o comprador vê no carrinho e que entram no checkout: produto ativo de vendedor aprovado.
// Carrinho e checkout usam o mesmo filtro para que o total exibido seja o total do pedido.
export const purchasableCartItem = {
  product: { active: true, seller: { status: 'APPROVED' } },
} satisfies Prisma.CartItemWhereInput;

export type SellerLine = { sellerId: string; storeName: string; subtotalCents: number };

export type SellerGroup<T extends SellerLine> = {
  sellerId: string;
  storeName: string;
  items: T[];
  subtotalCents: number;
};

// Subtotal de um item: preço unitário x quantidade.
export function lineSubtotalCents(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity;
}

// CA04/CA05: agrupa os itens por vendedor, somando o subtotal de cada loja.
export function groupBySeller<T extends SellerLine>(lines: T[]): SellerGroup<T>[] {
  const groups = new Map<string, SellerGroup<T>>();
  for (const line of lines) {
    let group = groups.get(line.sellerId);
    if (!group) {
      group = { sellerId: line.sellerId, storeName: line.storeName, items: [], subtotalCents: 0 };
      groups.set(line.sellerId, group);
    }
    group.items.push(line);
    group.subtotalCents += line.subtotalCents;
  }
  return [...groups.values()];
}

// Total geral: soma dos subtotais de todas as lojas.
export function totalCents(lines: Array<{ subtotalCents: number }>): number {
  return lines.reduce((sum, line) => sum + line.subtotalCents, 0);
}
