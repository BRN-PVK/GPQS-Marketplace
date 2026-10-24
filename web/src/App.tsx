import { Link, Navigate, Route, Routes } from 'react-router-dom';

function Nav() {
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
      </div>
    </header>
  );
}

function Home() {
  return (
    <section className="notice">
      <h1>Marketplace UFSCar</h1>
      <p className="muted">
        Ambiente configurado. Contas e vendedores (C04) e catálogo de produtos (C05) serão
        adicionados nas próximas entregas.
      </p>
    </section>
  );
}

export function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">Marketplace UFSCar</footer>
    </>
  );
}
