// C09: andamento da parte de cada vendedor no pedido (retirada combinada, sem frete).
export type FulfillmentStatus = 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COMPLETED';

const FLOW: FulfillmentStatus[] = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED'];

const LABELS: Record<FulfillmentStatus, string> = {
  CONFIRMED: 'Confirmado',
  PREPARING: 'Em preparação',
  READY_FOR_PICKUP: 'Disponível para retirada',
  COMPLETED: 'Concluído',
};

export function fulfillmentLabel(status: string) {
  return LABELS[status as FulfillmentStatus] ?? status;
}

// Próxima etapa que o vendedor pode marcar, ou null quando já está concluído.
export function nextFulfillment(status: string): FulfillmentStatus | null {
  const index = FLOW.indexOf(status as FulfillmentStatus);
  return index >= 0 && index < FLOW.length - 1 ? FLOW[index + 1] : null;
}

// Classe do selo: concluído em verde, demais etapas em andamento.
export function fulfillmentBadgeClass(status: string) {
  return status === 'COMPLETED' ? 'badge approved' : status === 'READY_FOR_PICKUP' ? 'badge ready' : 'badge pending';
}
