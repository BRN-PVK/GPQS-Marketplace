import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

type OrderItem = { id: string; productId: string; name: string; unitPriceCents: number; quantity: number; subtotalCents: number; fulfillmentStatus: string };
type OrderGroup = { sellerId: string; storeName: string; subtotalCents: number; items: OrderItem[] };
type Order = { id: string; status: string; totalCents: number; createdAt: string; groups: OrderGroup[] };
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function statusLabel(status: string) { return status === 'PENDING_PAYMENT' ? 'Aguardando pagamento' : status === 'CONFIRMED' ? 'Confirmado' : status === 'REJECTED' ? 'Pagamento recusado' : status; }

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const location = useLocation();
  const createdOrderId = (location.state as { createdOrderId?: string } | null)?.createdOrderId;

  useEffect(() => {
    api<Order[]>('/orders')
      .then(setOrders)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar os pedidos.'))
      .finally(() => setLoading(false));
  }, []);

  return <section>
    <div className="section-head"><h1>Meus pedidos</h1><Link to="/">Continuar comprando</Link></div>
    {createdOrderId && <p className="success-message" role="status">Pedido criado com sucesso! Número do pedido: <strong>{createdOrderId}</strong>. O pagamento será tratado na próxima etapa.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p>Carregando pedidos…</p> : orders.length === 0 ? <div className="empty"><p>Você ainda não tem pedidos.</p><Link to="/">Explorar produtos</Link></div> : <div className="cart-groups">
      {orders.map((order) => <article className="cart-store" key={order.id}>
        <div className="cart-store-head"><div><h2>Pedido #{order.id}</h2><p className="muted">{new Date(order.createdAt).toLocaleString('pt-BR')} · {statusLabel(order.status)}</p></div><strong>Total: {money(order.totalCents)}</strong></div>
        {order.groups.map((group) => <section key={group.sellerId} className="order-store-group">
          <h3>🏬 {group.storeName} · {money(group.subtotalCents)}</h3>
          {group.items.map((item) => <p key={item.id}>{item.name} × {item.quantity} — {money(item.subtotalCents)}</p>)}
        </section>)}
      </article>)}
    </div>}
  </section>;
}
