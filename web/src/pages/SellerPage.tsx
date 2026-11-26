import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fulfillmentBadgeClass, fulfillmentLabel, nextFulfillment } from '../lib/fulfillment';
import { SellerProducts, type SellerProduct } from './SellerProducts';

export function SellerPage() {
  const { user, seller, refresh } = useAuth();

  // Comprador ainda sem perfil de vendedor -> formulário de solicitação.
  if (user?.role === 'BUYER' || !seller) {
    return <RequestSeller onDone={refresh} />;
  }

  if (seller.status === 'PENDING') {
    return (
      <section className="notice">
        <h1>Loja: {seller.storeName}</h1>
        <p className="badge pending">Aguardando aprovação do administrador</p>
        <p className="muted">Você poderá cadastrar produtos assim que for aprovado (CA01).</p>
      </section>
    );
  }

  if (seller.status === 'REJECTED') {
    return (
      <section className="notice">
        <h1>Loja: {seller.storeName}</h1>
        <p className="badge rejected">Solicitação rejeitada</p>
        <p className="muted">Entre em contato com o administrador para mais informações.</p>
      </section>
    );
  }

  return <SellerDashboard storeName={seller.storeName} onStoreNameUpdated={refresh} />;
}

type SellerSummary = {
  totalGrossCents: number;
  totalCommissionCents: number;
  totalNetCents: number;
  confirmedOrdersCount: number;
};

type SellerSale = {
  orderId: string;
  orderStatus: string;
  createdAt: string;
  buyer: { name: string; email: string };
  commission: {
    baseAmountCents: number;
    rateBps: number;
    amountCents: number;
    netAmountCents: number;
  } | null;
  items: Array<{
    id: string;
    name: string;
    unitPriceCents: number;
    quantity: number;
    subtotalCents: number;
  }>;
  subtotalCents: number;
  fulfillmentStatus: string;
};

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function SellerDashboard({
  storeName,
  onStoreNameUpdated,
}: {
  storeName: string;
  onStoreNameUpdated?: () => Promise<void>;
}) {
  const [currentStoreName, setCurrentStoreName] = useState(storeName);
  const [editingStore, setEditingStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState(storeName);
  const [storeError, setStoreError] = useState('');
  const [storeBusy, setStoreBusy] = useState(false);
  const [storeSuccess, setStoreSuccess] = useState('');

  const [tab, setTab] = useState<'sales' | 'products'>('sales');
  const [summary, setSummary] = useState<SellerSummary | null>(null);
  const [sales, setSales] = useState<SellerSale[]>([]);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [advancingOrderId, setAdvancingOrderId] = useState('');

  useEffect(() => {
    setCurrentStoreName(storeName);
  }, [storeName]);

  // D02 (RF02): vendedor edita seus dados básicos (nome da loja).
  async function handleUpdateStoreName(e: React.FormEvent) {
    e.preventDefault();
    setStoreError('');
    setStoreSuccess('');
    const trimmed = newStoreName.trim();
    if (trimmed.length < 2) {
      setStoreError('Nome da loja muito curto (mínimo de 2 caracteres).');
      return;
    }
    setStoreBusy(true);
    try {
      const res = await api<{ id: string; storeName: string; status: string }>('/sellers/me', {
        method: 'PATCH',
        body: JSON.stringify({ storeName: trimmed }),
      });
      setCurrentStoreName(res.storeName);
      setEditingStore(false);
      setStoreSuccess(`Nome da loja atualizado para "${res.storeName}" com sucesso!`);
      if (onStoreNameUpdated) {
        await onStoreNameUpdated();
      }
    } catch (err) {
      setStoreError(err instanceof ApiError ? err.message : 'Falha ao atualizar nome da loja.');
    } finally {
      setStoreBusy(false);
    }
  }

  // C09: avança o andamento da parte desta loja no pedido (um estado por vez).
  async function advanceFulfillment(orderId: string, status: string) {
    setAdvancingOrderId(orderId);
    setError('');
    try {
      await api(`/seller/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSales((prev) => prev.map((s) => (s.orderId === orderId ? { ...s, fulfillmentStatus: status } : s)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o andamento.');
    } finally {
      setAdvancingOrderId('');
    }
  }

  // D01: recarrega apenas os produtos após cadastrar, editar ou (des)ativar.
  async function reloadProducts() {
    setProducts(await api<SellerProduct[]>('/seller/products'));
  }

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [ordersRes, productsRes] = await Promise.all([
        api<{ summary: SellerSummary; sales: SellerSale[] }>('/seller/orders'),
        api<SellerProduct[]>('/seller/products'),
      ]);
      setSummary(ordersRes.summary);
      setSales(ordersRes.sales);
      setProducts(productsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados da loja.');
    } finally {
      setLoading(false);
    }
  }

  useState(() => {
    void loadData();
  });

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Painel da Loja: {currentStoreName}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <span className="badge approved">Vendedor aprovado</span>
            {!editingStore && (
              <button
                type="button"
                className="btn-link"
                style={{ fontSize: '0.88rem' }}
                onClick={() => {
                  setNewStoreName(currentStoreName);
                  setStoreError('');
                  setStoreSuccess('');
                  setEditingStore(true);
                }}
              >
                Editar dados da loja
              </button>
            )}
          </div>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void loadData()}>
          Atualizar dados
        </button>
      </div>

      {editingStore && (
        <form
          onSubmit={handleUpdateStoreName}
          className="form"
          style={{
            maxWidth: '460px',
            margin: '12px 0 20px',
            background: 'var(--surface)',
            padding: '16px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}
        >
          <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>Editar dados básicos da loja (RF02)</h3>
          <label>
            Nome da loja
            <input
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              required
              minLength={2}
            />
          </label>
          {storeError && <p className="error" role="alert">{storeError}</p>}
          <div className="actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="submit" disabled={storeBusy}>
              {storeBusy ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={storeBusy}
              onClick={() => {
                setEditingStore(false);
                setStoreError('');
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {storeSuccess && (
        <p className="success-message" role="status" style={{ marginBottom: '16px' }}>
          {storeSuccess}
        </p>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {/* Cards de Métricas e Comissões (C08) */}
      {summary && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Vendas Brutas (Confirmadas)</span>
            <span className="stat-value">{money(summary.totalGrossCents)}</span>
            <span className="stat-hint">{summary.confirmedOrdersCount} pedidos pagos</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Comissão do Marketplace (10%)</span>
            <span className="stat-value" style={{ color: 'var(--warn)' }}>
              − {money(summary.totalCommissionCents)}
            </span>
            <span className="stat-hint">Taxa de intermediação retida</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Saldo Líquido a Receber</span>
            <span className="stat-value" style={{ color: 'var(--ok)' }}>
              {money(summary.totalNetCents)}
            </span>
            <span className="stat-hint">Valor após desconto da comissão</span>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="tabs-nav">
        <button
          type="button"
          className={`tab-btn ${tab === 'sales' ? 'active' : ''}`}
          onClick={() => setTab('sales')}
        >
          Extrato de Vendas e Comissões ({sales.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'products' ? 'active' : ''}`}
          onClick={() => setTab('products')}
        >
          Meus Produtos ({products.length})
        </button>
      </div>

      {loading ? (
        <p>Carregando dados da loja…</p>
      ) : tab === 'sales' ? (
        sales.length === 0 ? (
          <div className="empty">
            <p>Nenhuma venda registrada ainda para esta loja.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data</th>
                <th>Comprador</th>
                <th>Itens Vendidos</th>
                <th>Subtotal Bruto</th>
                <th>Comissão (10%)</th>
                <th>Valor Líquido</th>
                <th>Status</th>
                <th>Andamento</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.orderId}>
                  <td>#{s.orderId.slice(-6)}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td>{s.buyer.name}</td>
                  <td>
                    {s.items.map((i) => (
                      <div key={i.id} style={{ fontSize: '0.85rem' }}>
                        {i.name} ({i.quantity}x)
                      </div>
                    ))}
                  </td>
                  <td><strong>{money(s.subtotalCents)}</strong></td>
                  <td style={{ color: 'var(--warn)' }}>
                    {s.commission ? `− ${money(s.commission.amountCents)}` : '—'}
                  </td>
                  <td style={{ color: 'var(--ok)', fontWeight: 700 }}>
                    {s.commission ? money(s.commission.netAmountCents) : '—'}
                  </td>
                  <td>
                    {s.orderStatus === 'CONFIRMED' ? (
                      <span className="badge approved">Pago</span>
                    ) : s.orderStatus === 'PENDING_PAYMENT' ? (
                      <span className="badge pending">Aguardando</span>
                    ) : (
                      <span className="badge rejected">Recusado</span>
                    )}
                  </td>
                  <td>
                    {s.orderStatus === 'CONFIRMED' ? (
                      <div className="fulfillment-cell">
                        <span className={fulfillmentBadgeClass(s.fulfillmentStatus)}>
                          {fulfillmentLabel(s.fulfillmentStatus)}
                        </span>
                        {nextFulfillment(s.fulfillmentStatus) && (
                          <button
                            type="button"
                            className="btn-secondary btn-small"
                            disabled={advancingOrderId === s.orderId}
                            onClick={() => void advanceFulfillment(s.orderId, nextFulfillment(s.fulfillmentStatus)!)}
                          >
                            {advancingOrderId === s.orderId
                              ? 'Atualizando…'
                              : `Marcar: ${fulfillmentLabel(nextFulfillment(s.fulfillmentStatus)!)}`}
                          </button>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        /* Aba de Produtos (D01: cadastro, edição e desativação) */
        <SellerProducts products={products} onReload={reloadProducts} />
      )}
    </section>
  );
}


function RequestSeller({ onDone }: { onDone: () => Promise<void> }) {
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/sellers/request', {
        method: 'POST',
        body: JSON.stringify({ storeName }),
      });
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao solicitar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-wrap">
      <h1>Quero vender</h1>
      <p className="muted">
        Solicite o cadastro como vendedor. Após a aprovação do administrador você poderá publicar
        produtos.
      </p>
      <form onSubmit={submit} className="form">
        <label>
          Nome da loja
          <input value={storeName} onChange={(e) => setStoreName(e.target.value)} required minLength={2} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Enviando…' : 'Solicitar cadastro'}
        </button>
      </form>
    </section>
  );
}
