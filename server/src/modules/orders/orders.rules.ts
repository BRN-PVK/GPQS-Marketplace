// Regras de validação do checkout (C07), isoladas para teste unitário.

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
