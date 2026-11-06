import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type OrderItem = {
  id: string;
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  fulfillmentStatus: string;
};

type OrderGroup = {
  sellerId: string;
  storeName: string;
  subtotalCents: number;
  items: OrderItem[];
};

type PaymentInfo = {
  id: string;
  result: 'APPROVED' | 'REJECTED';
  createdAt: string;
};

type Order = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  payment?: PaymentInfo | null;
  groups: OrderGroup[];
};

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function statusBadge(status: string) {
  if (status === 'PENDING_PAYMENT') return <span className="badge pending">Aguardando pagamento</span>;
  if (status === 'CONFIRMED') return <span className="badge approved">Confirmado</span>;
  if (status === 'REJECTED') return <span className="badge rejected">Pagamento recusado</span>;
  return <span className="badge">{status}</span>;
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [busyOrderId, setBusyOrderId] = useState('');
  const location = useLocation();
  const createdOrderId = (location.state as { createdOrderId?: string } | null)?.createdOrderId;

  useEffect(() => {
    api<Order[]>('/orders')
      .then(setOrders)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os pedidos.'),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handlePay(orderId: string, result: 'APPROVED' | 'REJECTED') {
    setBusyOrderId(orderId);
    setError('');
    setActionNotice('');
    try {
      const updated = await api<Order>(`/orders/${orderId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ result }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (result === 'APPROVED') {
        setActionNotice(`Pagamento do pedido #${orderId} aprovado! Estoque atualizado e comissões registradas.`);
      } else {
        setActionNotice(`Pagamento do pedido #${orderId} foi simulado como recusado.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao processar pagamento.');
    } finally {
      setBusyOrderId('');
    }
  }

  return (
    <section>
      <div className="section-head">
        <h1>Meus pedidos</h1>
        <Link to="/">Continuar comprando</Link>
      </div>

      {createdOrderId && (
        <p className="success-message" role="status">
          Pedido criado com sucesso! Número do pedido: <strong>{createdOrderId}</strong>. Simule o
          pagamento abaixo para concluir a compra.
        </p>
      )}

      {actionNotice && <p className="success-message" role="status">{actionNotice}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {loading ? (
        <p>Carregando pedidos…</p>
      ) : orders.length === 0 ? (
        <div className="empty">
          <p>Você ainda não tem pedidos.</p>
          <Link to="/">Explorar produtos</Link>
        </div>
      ) : (
        <div className="cart-groups">
          {orders.map((order) => (
            <article className="cart-store" key={order.id}>
              <div className="cart-store-head">
                <div>
                  <h2>Pedido #{order.id}</h2>
                  <p className="muted">
                    {new Date(order.createdAt).toLocaleString('pt-BR')} · {statusBadge(order.status)}
                  </p>
                </div>
                <strong>Total: {money(order.totalCents)}</strong>
              </div>

              {order.groups.map((group) => (
                <section key={group.sellerId} className="order-store-group">
                  <h3>🏬 {group.storeName} · {money(group.subtotalCents)}</h3>
                  {group.items.map((item) => (
                    <p key={item.id}>
                      {item.name} × {item.quantity} — {money(item.subtotalCents)}
                    </p>
                  ))}
                </section>
              ))}

              {order.status === 'PENDING_PAYMENT' && (
                <div className="payment-box">
                  <div className="payment-box-head">
                    <p>
                      💳 <strong>Simulação de Pagamento (C08):</strong> Escolha como simular a transação.
                    </p>
                    <div className="payment-actions">
                      <button
                        type="button"
                        className="btn-dark"
                        disabled={busyOrderId === order.id}
                        onClick={() => void handlePay(order.id, 'APPROVED')}
                      >
                        {busyOrderId === order.id ? 'Processando…' : 'Simular Pagamento Aprovado'}
                      </button>
                      <button
                        type="button"
                        className="btn-link danger"
                        disabled={busyOrderId === order.id}
                        onClick={() => void handlePay(order.id, 'REJECTED')}
                      >
                        Simular Recusa
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {order.payment && (
                <div className="payment-info">
                  {order.payment.result === 'APPROVED' ? '✅' : '❌'}{' '}
                  Pagamento {order.payment.result === 'APPROVED' ? 'aprovado' : 'recusado'} em{' '}
                  {new Date(order.payment.createdAt).toLocaleString('pt-BR')}.
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

