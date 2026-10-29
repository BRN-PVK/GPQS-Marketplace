import { describe, it, expect } from 'vitest';
import { groupBySeller, lineSubtotalCents, totalCents } from './cart.rules.js';

function line(sellerId: string, unitPriceCents: number, quantity: number) {
  return {
    sellerId,
    storeName: `Loja ${sellerId}`,
    unitPriceCents,
    quantity,
    subtotalCents: lineSubtotalCents(unitPriceCents, quantity),
  };
}

describe('CA04 - totais do carrinho acompanham inclusão, exclusão e quantidade', () => {
  it('subtotal do item é preço unitário x quantidade, em centavos', () => {
    expect(lineSubtotalCents(1990, 3)).toBe(5970);
  });
  it('inclusão de item soma ao total', () => {
    const before = [line('a', 1000, 1)];
    const after = [...before, line('b', 2550, 2)];
    expect(totalCents(before)).toBe(1000);
    expect(totalCents(after)).toBe(6100);
  });
  it('alteração de quantidade recalcula o total', () => {
    expect(totalCents([line('a', 1000, 1)])).toBe(1000);
    expect(totalCents([line('a', 1000, 4)])).toBe(4000);
  });
  it('exclusão de item subtrai do total; carrinho vazio vale zero', () => {
    const cart = [line('a', 1000, 1), line('b', 500, 2)];
    expect(totalCents(cart.filter((l) => l.sellerId !== 'b'))).toBe(1000);
    expect(totalCents([])).toBe(0);
  });
});

describe('CA05 - compra com dois vendedores mantém itens e valores associados', () => {
  // Cenário do CA08: R$ 100,00 de um vendedor e R$ 50,00 de outro.
  const lines = [
    line('v1', 4000, 2),
    line('v2', 5000, 1),
    line('v1', 2000, 1),
  ];

  it('agrupa cada item sob o seu vendedor', () => {
    const groups = groupBySeller(lines);
    expect(groups.map((g) => g.sellerId)).toEqual(['v1', 'v2']);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
    expect(groups.every((g) => g.items.every((i) => i.sellerId === g.sellerId))).toBe(true);
  });
  it('subtotal de cada vendedor e total geral corretos', () => {
    const groups = groupBySeller(lines);
    expect(groups[0].subtotalCents).toBe(10000);
    expect(groups[1].subtotalCents).toBe(5000);
    expect(totalCents(lines)).toBe(15000);
    expect(totalCents(groups)).toBe(totalCents(lines));
  });
});
