// Regras de negócio puras (sem I/O) para facilitar testes unitários.
// Referências: Declaração de Escopo (regras de negócio e critérios de aceite).

// CA01: somente vendedor APROVADO pode publicar/gerenciar produtos.
// Aceita string pois o SQLite armazena SellerStatus como texto.
export function canSellerPublish(status: string | undefined | null): boolean {
  return status === 'APPROVED';
}

// CA02: um vendedor só pode alterar os próprios produtos.
export function isProductOwner(productSellerId: string, requesterSellerId: string): boolean {
  return productSellerId === requesterSellerId;
}

export interface CatalogItem {
  name: string;
  category: string;
  active: boolean;
}

export interface CatalogFilters {
  q?: string;
  category?: string;
}

// CA03: catálogo mostra apenas produtos ativos; pesquisa por nome e filtro por categoria.
export function filterCatalog<T extends CatalogItem>(items: T[], filters: CatalogFilters): T[] {
  const q = filters.q?.trim().toLowerCase();
  const category = filters.category?.trim().toLowerCase();
  return items.filter((item) => {
    if (!item.active) return false;
    if (q && !item.name.toLowerCase().includes(q)) return false;
    if (category && item.category.toLowerCase() !== category) return false;
    return true;
  });
}

// CA08 (usado em C08): comissão em centavos, taxa em pontos-base, arredondamento half-up.
// Mantida aqui por ser regra central de cálculo (testada desde já).
export function calcCommissionCents(baseAmountCents: number, rateBps: number): number {
  if (baseAmountCents < 0 || rateBps < 0) {
    throw new Error('Base e taxa não podem ser negativas.');
  }
  // half-up: adiciona metade do divisor antes da divisão inteira.
  return Math.floor((baseAmountCents * rateBps + 5000) / 10000);
}
