import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface SellerRow {
  id: string;
  storeName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  user: { name: string; email: string };
  createdAt: string;
}

export function AdminPage() {
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const query = filter ? `?status=${filter}` : '';
      setSellers(await api<SellerRow[]>(`/admin/sellers${query}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function act(id: string, action: 'approve' | 'reject') {
    await api(`/admin/sellers/${id}/${action}`, { method: 'POST' });
    await load();
  }

  return (
    <section>
      <h1>Aprovação de vendedores</h1>
      <div className="filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="PENDING">Pendentes</option>
          <option value="APPROVED">Aprovados</option>
          <option value="REJECTED">Rejeitados</option>
          <option value="">Todos</option>
        </select>
      </div>

      {loading ? (
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
    </section>
  );
}

function statusLabel(status: SellerRow['status']) {
  return status === 'PENDING' ? 'Pendente' : status === 'APPROVED' ? 'Aprovado' : 'Rejeitado';
}
