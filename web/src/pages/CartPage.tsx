import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type CartItem = {
  id: string;
  productId: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  quantity: number;
  stockQty: number;
  storeName: string;
  sellerId: string;
  subtotalCents: number;
};
type CartGroup = { sellerId: string; storeName: string; items: CartItem[]; subtotalCents: number };
type Cart = { id: string | null; groups: CartGroup[]; itemsCount: number; totalCents: number };

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const navigate = useNavigate();

  const loadCart = useCallback(async () => {
    setError('');
    try {
      setCart(await api<Cart>('/cart'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o carrinho.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCart(); }, [loadCart]);

  async function checkout() {
    setCheckingOut(true);
    setError('');
    try {
      const order = await api<{ id: string }>('/orders/checkout', { method: 'POST' });
      navigate('/pedidos', { state: { createdOrderId: order.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível finalizar a compra.');
    } finally {
      setCheckingOut(false);
    }
  }

  async function updateQuantity(item: CartItem, quantity: number) {
    if (quantity < 1 || quantity > item.stockQty) return;
    setBusyItem(item.id);
    setError('');
    setNotice('');
    try {
      setCart(await api<Cart>(`/cart/items/${item.id}`, {
        method: 'PATCH', body: JSON.stringify({ quantity }),
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível alterar a quantidade.');
    } finally {
      setBusyItem('');
    }
  }

  async function removeItem(item: CartItem) {
    setBusyItem(item.id);
    setError('');
    setNotice('');
    try {
      setCart(await api<Cart>(`/cart/items/${item.id}`, { method: 'DELETE' }));
      setNotice(`${item.name} foi removido do carrinho.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível remover o item.');
    } finally {
      setBusyItem('');
    }
  }

  if (loading) return <p>Carregando carrinho…</p>;

  return (
    <section>
      <div className="section-head">
        <h1>Meu carrinho</h1>
        <span><Link to="/pedidos">Meus pedidos</Link> · <Link to="/">Continuar comprando</Link></span>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {!cart || cart.itemsCount === 0 ? (
        <div className="empty">
          <p>Seu carrinho está vazio.</p>
          <Link to="/">Explorar produtos</Link>
        </div>
      ) : (
        <>
          <p className="muted">{cart.itemsCount} {cart.itemsCount === 1 ? 'unidade' : 'unidades'} no carrinho</p>
          <div className="cart-groups">
            {cart.groups.map((group) => (
              <section className="cart-store" key={group.sellerId}>
                <div className="cart-store-head">
                  <h2>🏬 {group.storeName}</h2>
                  <strong>Subtotal da loja: {money(group.subtotalCents)}</strong>
                </div>
                {group.items.map((item) => (
                  <article className="cart-item" key={item.id}>
                    <div className="cart-item-info">
                      <h3>{item.name}</h3>
                      <p className="muted">{item.category} · {money(item.priceCents)} cada</p>
                      <p className="cart-line-total">Subtotal: {money(item.subtotalCents)}</p>
                    </div>
                    <div className="cart-item-actions">
                      <label className="quantity-control">
                        Quantidade
                        <span>
                          <button type="button" className="btn-secondary quantity-button" aria-label={`Diminuir ${item.name}`} disabled={busyItem === item.id || item.quantity <= 1} onClick={() => void updateQuantity(item, item.quantity - 1)}>−</button>
                          <input aria-label={`Quantidade de ${item.name}`} type="number" min={1} max={item.stockQty} value={item.quantity} readOnly disabled={busyItem === item.id} />
                          <button type="button" className="btn-secondary quantity-button" aria-label={`Aumentar ${item.name}`} disabled={busyItem === item.id || item.quantity >= item.stockQty} onClick={() => void updateQuantity(item, item.quantity + 1)}>+</button>
                        </span>
                      </label>
                      <button type="button" className="btn-link danger" disabled={busyItem === item.id} onClick={() => void removeItem(item)}>
                        Remover
                      </button>
                      {item.quantity > item.stockQty && <p className="error">Estoque atual: {item.stockQty}</p>}
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </div>
          <aside className="cart-summary">
            <div><span>Total geral</span><strong>{money(cart.totalCents)}</strong></div>
            <p className="muted">Checkout único: seu pedido reunirá os produtos de todas as lojas. O pagamento será tratado na próxima etapa.</p>
            <button type="button" className="btn-dark" disabled={checkingOut || busyItem !== ''} onClick={() => void checkout()}>{checkingOut ? 'Finalizando…' : 'Finalizar compra'}</button>
          </aside>
        </>
      )}
    </section>
  );
}
