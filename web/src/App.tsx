import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SellerPage } from './pages/SellerPage';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { CartPage } from './pages/CartPage';
import { OrdersPage } from './pages/OrdersPage';
import type { Role } from './lib/auth';
import type { ReactNode } from 'react';

function Nav() {
  const { user, seller, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span className="logo">🛒</span>
          <span>
            Marketplace
            <small>UFSCar</small>
          </span>
        </Link>
        <nav className="nav-links">
          <Link to="/">Início</Link>
          {user?.role === 'BUYER' && <Link to="/carrinho">Carrinho</Link>}
          {user?.role === 'BUYER' && <Link to="/pedidos">Meus pedidos</Link>}
          {user?.role === 'SELLER' && <Link to="/vendedor">Minha loja</Link>}
          {user?.role === 'BUYER' && <Link to="/vendedor">Vender</Link>}
          {user?.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
          {user ? (
            <>
              <span className="nav-user">
                {user.name}
                <span className="badge">{roleLabel(user.role, seller?.status)}</span>
              </span>
              <button
                className="btn-link"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Entrar</Link>
              <Link to="/cadastro">Cadastrar</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function roleLabel(role: Role, status?: string) {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'BUYER') return 'Comprador';
  if (role === 'SELLER') return `Vendedor (${status ?? '—'})`;
  return role;
}

function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="container">Carregando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}


export function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/pedidos"
            element={
              <Protected roles={['BUYER']}>
                <OrdersPage />
              </Protected>
            }
          />
          <Route
            path="/carrinho"
            element={
              <Protected roles={['BUYER']}>
                <CartPage />
              </Protected>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route
            path="/vendedor"
            element={
              <Protected roles={['BUYER', 'SELLER']}>
                <SellerPage />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected roles={['ADMIN']}>
                <AdminPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">Marketplace UFSCar</footer>
    </>
  );
}
