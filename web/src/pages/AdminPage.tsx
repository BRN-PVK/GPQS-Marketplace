import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface SellerRow {
  id: string;
  storeName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  user: { name: string; email: string };
  createdAt: string;
}

interface CommissionRow {
  id: string;
  orderId: string;
  sellerId: string;
  storeName: string;
  baseAmountCents: number;
  rateBps: number;
  amountCents: number;
  createdAt: string;
  orderStatus: string;
}

interface CommissionsReport {
  summary: {
    totalCommissionsCents: number;
    totalBaseCents: number;
    commissionsCount: number;
  };
  commissions: CommissionRow[];
}

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'sellers' | 'commissions'>('sellers');
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');
  const [loadingSellers, setLoadingSellers] = useState(true);

  const [commissionsReport, setCommissionsReport] = useState<CommissionsReport | null>(null);
  const [loadingCommissions, setLoadingCommissions] = useState(false);

  async function loadSellers() {
    setLoadingSellers(true);
    try {
      const query = filter ? `?status=${filter}` : '';
      setSellers(await api<SellerRow[]>(`/admin/sellers${query}`));
    } finally {
      setLoadingSellers(false);
    }
  }

  async function loadCommissions() {
    setLoadingCommissions(true);
    try {
      setCommissionsReport(await api<CommissionsReport>('/admin/commissions'));
    } finally {
      setLoadingCommissions(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'sellers') {
      void loadSellers();
    } else {
      void loadCommissions();
    }
  }, [activeTab, filter]);

  async function act(id: string, action: 'approve' | 'reject') {
    await api(`/admin/sellers/${id}/${action}`, { method: 'POST' });
    await loadSellers();
  }

  return (
    <section>
      <h1>Painel Administrativo</h1>

      <div className="tabs-nav">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'sellers' ? 'active' : ''}`}
          onClick={() => setActiveTab('sellers')}
        >
          Aprovação de Vendedores
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'commissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('commissions')}
        >
          Comissões do Marketplace (C08)
        </button>
      </div>

      {activeTab === 'sellers' ? (
        <div>
          <div className="filters">
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="PENDING">Pendentes</option>
              <option value="APPROVED">Aprovados</option>
              <option value="REJECTED">Rejeitados</option>
              <option value="">Todos</option>
            </select>
          </div>

          {loadingSellers ? (
            <p>Carregando…</p>
          ) : sellers.length === 0 ? (
            <p className="empty">Nenhum vendedor nesta situação.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Loja</th>
                  <th>Responsável</th>
                  <th>E-mail</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.storeName}</td>
                    <td>{s.user.name}</td>
                    <td>{s.user.email}</td>
                    <td>
                      <span className={`badge ${s.status.toLowerCase()}`}>{statusLabel(s.status)}</span>
                    </td>
                    <td className="row-actions">
                      {s.status !== 'APPROVED' && (
                        <button className="btn-link" onClick={() => act(s.id, 'approve')}>
                          Aprovar
                        </button>
                      )}
                      {s.status !== 'REJECTED' && (
                        <button className="btn-link danger" onClick={() => act(s.id, 'reject')}>
                          Rejeitar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Aba de Comissões do Marketplace */
        <div>
          {loadingCommissions ? (
            <p>Carregando comissões…</p>
          ) : commissionsReport ? (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Comissões Totais Retidas</span>
                  <span className="stat-value" style={{ color: 'var(--ok)' }}>
                    {money(commissionsReport.summary.totalCommissionsCents)}
                  </span>
                  <span className="stat-hint">{commissionsReport.summary.commissionsCount} repasses registrados</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Volume Total Transacionado</span>
                  <span className="stat-value">
                    {money(commissionsReport.summary.totalBaseCents)}
                  </span>
                  <span className="stat-hint">Base total de cálculo de vendas</span>
                </div>
              </div>

              {commissionsReport.commissions.length === 0 ? (
                <div className="empty">
                  <p>Nenhuma comissão registrada ainda. Realize pagamentos de pedidos para gerar comissões.</p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Data</th>
                      <th>Loja Parceira</th>
                      <th>Valor da Venda</th>
                      <th>Taxa</th>
                      <th>Comissão da Plataforma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionsReport.commissions.map((c) => (
                      <tr key={c.id}>
                        <td>#{c.orderId.slice(-6)}</td>
                        <td>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td><strong>{c.storeName}</strong></td>
                        <td>{money(c.baseAmountCents)}</td>
                        <td>{(c.rateBps / 100).toFixed(1)}%</td>
                        <td style={{ color: 'var(--ok)', fontWeight: 700 }}>
                          +{money(c.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <p>Falha ao carregar relatório.</p>
          )}
        </div>
      )}
    </section>
  );
}

function statusLabel(status: SellerRow['status']) {
  return status === 'PENDING' ? 'Pendente' : status === 'APPROVED' ? 'Aprovado' : 'Rejeitado';
}

