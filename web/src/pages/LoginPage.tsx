import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-wrap">
      <h1>Entrar</h1>
      <form onSubmit={onSubmit} className="form">
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <div className="hint">
        <strong>Contas de demonstração</strong> (senha <code>senha123</code>):
        <ul>
          <li>admin@marketplace.ufscar — administrador</li>
          <li>vendedor@teste.com — vendedor aprovado</li>
          <li>pendente@teste.com — vendedor pendente</li>
          <li>comprador@teste.com — comprador</li>
        </ul>
      </div>
    </section>
  );
}
