import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

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

  return <SellerDashboard storeName={seller.storeName} />;
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
};

type SellerProduct = {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  stockQty: number;
  active: boolean;
};

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function SellerDashboard({ storeName }: { storeName: string }) {
  const [tab, setTab] = useState<'sales' | 'products'>('sales');
  const [summary, setSummary] = useState<SellerSummary | null>(null);
  const [sales, setSales] = useState<SellerSale[]>([]);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          <h1>Painel da Loja: {storeName}</h1>
          <span className="badge approved">Vendedor aprovado</span>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void loadData()}>
          Atualizar dados
        </button>
      </div>

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
          Estoque de Produtos ({products.length})
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
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        /* Aba de Produtos e Estoque */
        <div>
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Preço Unitário</th>
                <th>Estoque Atual</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.category}</td>
                  <td>{money(p.priceCents)}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: p.stockQty === 0 ? 'var(--danger)' : 'inherit' }}>
                      {p.stockQty} {p.stockQty === 1 ? 'unidade' : 'unidades'}
                    </span>
                  </td>
                  <td>
                    {p.stockQty > 0 ? (
                      <span className="badge approved">Em estoque</span>
                    ) : (
                      <span className="badge rejected">Esgotado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
