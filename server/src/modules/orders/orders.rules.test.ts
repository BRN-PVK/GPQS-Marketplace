import { describe, it, expect } from 'vitest';
import {
  findCheckoutConflict,
  calculateOrderCommissions,
  validateStockAvailability,
} from './orders.rules.js';

function line(name: string, quantity: number, stockQty: number, priceCents = 1000) {
  return { quantity, product: { name, priceCents, stockQty } };
}

describe('CA07 - checkout impede quantidade superior ao estoque', () => {
  it('libera quando todas as quantidades cabem no estoque', () => {
    expect(findCheckoutConflict([line('A', 2, 2), line('B', 1, 10)])).toBeUndefined();
  });
  it('bloqueia o item cuja quantidade excede o estoque', () => {
    expect(findCheckoutConflict([line('A', 1, 5), line('B', 3, 2)])?.product.name).toBe('B');
  });
  it('bloqueia produto que ficou sem estoque depois de entrar no carrinho', () => {
    expect(findCheckoutConflict([line('A', 1, 0)])?.product.name).toBe('A');
  });
  it('bloqueia quantidade inválida ou produto sem preço', () => {
    expect(findCheckoutConflict([line('A', 0, 5)])?.product.name).toBe('A');
    expect(findCheckoutConflict([line('B', 1, 5, 0)])?.product.name).toBe('B');
  });
});

describe('CA08 - comissões no pedido multivendedor (C08)', () => {
  const rateBps = 1000; // 10%

  it('calcula comissões separadas para dois vendedores (cenário CA08: R$100 e R$50)', () => {
    const items = [
      { sellerId: 'v1', unitPriceCents: 4000, quantity: 2 }, // R$ 80,00
      { sellerId: 'v2', unitPriceCents: 5000, quantity: 1 }, // R$ 50,00
      { sellerId: 'v1', unitPriceCents: 2000, quantity: 1 }, // R$ 20,00
    ];

    const commissions = calculateOrderCommissions(items, rateBps);
    expect(commissions).toHaveLength(2);

    const commV1 = commissions.find((c) => c.sellerId === 'v1')!;
    expect(commV1.baseAmountCents).toBe(10000); // R$ 100,00
    expect(commV1.amountCents).toBe(1000);     // 10% = R$ 10,00
    expect(commV1.netAmountCents).toBe(9000);   // R$ 90,00

    const commV2 = commissions.find((c) => c.sellerId === 'v2')!;
    expect(commV2.baseAmountCents).toBe(5000);  // R$ 50,00
    expect(commV2.amountCents).toBe(500);      // 10% = R$ 5,00
    expect(commV2.netAmountCents).toBe(4500);   // R$ 45,00
  });

  it('aplica arredondamento half-up na comissão de cada vendedor', () => {
    const items = [
      { sellerId: 'v1', unitPriceCents: 99, quantity: 1 }, // 9,9 centavos -> 10
      { sellerId: 'v2', unitPriceCents: 94, quantity: 1 }, // 9,4 centavos -> 9
    ];

    const commissions = calculateOrderCommissions(items, rateBps);
    expect(commissions.find((c) => c.sellerId === 'v1')?.amountCents).toBe(10);
    expect(commissions.find((c) => c.sellerId === 'v2')?.amountCents).toBe(9);
  });

  it('retorna lista vazia se não houver itens', () => {
    expect(calculateOrderCommissions([], rateBps)).toEqual([]);
  });
});

describe('C08 - validação de estoque para pagamento', () => {
  it('aprova quando estoque atual cobre todos os itens do pedido', () => {
    const items = [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 1 },
    ];
    const stock = [
      { id: 'p1', stockQty: 5 },
      { id: 'p2', stockQty: 1 },
    ];
    expect(validateStockAvailability(items, stock)).toEqual({ valid: true });
  });

  it('reprova e aponta o produto quando estoque atual for insuficiente', () => {
    const items = [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 3 },
    ];
    const stock = [
      { id: 'p1', stockQty: 5 },
      { id: 'p2', stockQty: 2 }, // precisa de 3
    ];
    expect(validateStockAvailability(items, stock)).toEqual({
      valid: false,
      conflictProductId: 'p2',
    });
  });
});

