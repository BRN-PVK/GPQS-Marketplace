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

  return (
    <section className="notice">
      <h1>Loja: {seller.storeName}</h1>
      <p className="badge approved">Vendedor aprovado</p>
      <p className="muted">
        Seu cadastro foi aprovado. O gerenciamento de produtos será disponibilizado na próxima
        entrega.
      </p>
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
