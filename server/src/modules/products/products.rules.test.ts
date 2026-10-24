import { describe, it, expect } from 'vitest';
import {
  canSellerPublish,
  isProductOwner,
  filterCatalog,
  calcCommissionCents,
  type CatalogItem,
} from './products.rules.js';

describe('CA01 - somente vendedor aprovado publica', () => {
  it('permite quando APPROVED', () => {
    expect(canSellerPublish('APPROVED')).toBe(true);
  });
  it('bloqueia quando PENDING ou REJECTED', () => {
    expect(canSellerPublish('PENDING')).toBe(false);
    expect(canSellerPublish('REJECTED')).toBe(false);
    expect(canSellerPublish(null)).toBe(false);
    expect(canSellerPublish(undefined)).toBe(false);
  });
});

describe('CA02 - vendedor só altera os próprios produtos', () => {
  it('permite quando o dono é o solicitante', () => {
    expect(isProductOwner('seller-1', 'seller-1')).toBe(true);
  });
  it('bloqueia quando o produto é de outro vendedor', () => {
    expect(isProductOwner('seller-1', 'seller-2')).toBe(false);
  });
});

describe('CA03 - catálogo: ativos, busca por nome e filtro por categoria', () => {
  const items: CatalogItem[] = [
    { name: 'Caderno Universitário', category: 'Papelaria', active: true },
    { name: 'Caneta Azul', category: 'Papelaria', active: true },
    { name: 'Calculadora', category: 'Eletrônicos', active: true },
    { name: 'Produto Inativo', category: 'Papelaria', active: false },
  ];

  it('retorna apenas ativos quando sem filtro', () => {
    expect(filterCatalog(items, {})).toHaveLength(3);
  });

  it('pesquisa por nome (case-insensitive, parcial)', () => {
    const r = filterCatalog(items, { q: 'can' });
    expect(r.map((i) => i.name)).toEqual(['Caneta Azul']);
  });

  it('filtra por categoria', () => {
    const r = filterCatalog(items, { category: 'Eletrônicos' });
    expect(r.map((i) => i.name)).toEqual(['Calculadora']);
  });

  it('combina busca e categoria e nunca traz inativo', () => {
    const r = filterCatalog(items, { q: 'produto', category: 'Papelaria' });
    expect(r).toHaveLength(0);
  });
});

describe('CA08 - cálculo de comissão (centavos, pontos-base, half-up)', () => {
  it('10% de R$100,00 = R$10,00', () => {
    expect(calcCommissionCents(10000, 1000)).toBe(1000);
  });
  it('arredonda half-up', () => {
    // 10% de R$0,99 = 9,9 centavos -> 10
    expect(calcCommissionCents(99, 1000)).toBe(10);
    // 10% de R$0,94 = 9,4 centavos -> 9
    expect(calcCommissionCents(94, 1000)).toBe(9);
  });
  it('rejeita valores negativos', () => {
    expect(() => calcCommissionCents(-1, 1000)).toThrow();
  });
});
