import { describe, it, expect } from 'vitest';
import { findCheckoutConflict } from './orders.rules.js';

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
