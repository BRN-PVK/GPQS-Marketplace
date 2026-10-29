import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  stockQty: number;
  inStock: boolean;
  storeName: string | null;
};

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [addingId, setAddingId] = useState('');

  async function loadProducts(search = query, selectedCategory = category) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (selectedCategory) params.set('category', selectedCategory);
      const suffix = params.toString();
      const data = await api<Product[]>(`/products${suffix ? `?${suffix}` : ''}`);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o catálogo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api<string[]>('/categories').then(setCategories).catch(() => setCategories([]));
    void loadProducts('', '');
    // Carregamento inicial intencional; filtros são aplicados pelo formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addToCart(product: Product) {
    if (!user) {
      navigate('/login', { state: { from: '/' } });
      return;
    }
    if (user.role !== 'BUYER') {
      setError('Apenas contas de comprador podem usar o carrinho.');
      return;
    }
    setAddingId(product.id);
    setError('');
    setNotice('');
    try {
      await api('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      setNotice(`${product.name} foi adicionado ao carrinho.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível adicionar o produto.');
    } finally {
      setAddingId('');
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void loadProducts(query, category);
  }

  return (
    <>
      <section className="hero">
        <div className="hero-card hero-main">
          <h2>Descubra produtos da comunidade UFSCar</h2>
          <p>Explore lojas diferentes e reúna tudo no mesmo carrinho.</p>
          <span className="emoji-bg" aria-hidden="true">🛍️</span>
        </div>
        <div className="hero-card hero-side">
          <h3>Compre local</h3>
          <p>Produtos de diferentes vendedores em um só lugar.</p>
        </div>
      </section>

      <form className="searchbar" onSubmit={submitSearch}>
        <input
          aria-label="Pesquisar produtos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="O que você está procurando?"
        />
        <select
          aria-label="Filtrar por categoria"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="search-btn" type="submit">Buscar</button>
      </form>

      {notice && <p className="success-message" role="status">{notice} <Link to="/carrinho">Ver carrinho</Link></p>}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="section-head">
        <h1>Produtos</h1>
        <span className="muted">{products.length} {products.length === 1 ? 'resultado' : 'resultados'}</span>
      </div>
      {loading ? <p className="muted">Carregando produtos…</p> : products.length === 0 ? (
        <div className="empty">Nenhum produto encontrado. Tente outra pesquisa ou categoria.</div>
      ) : (
        <div className="grid">
          {products.map((product) => (
            <article className="card" key={product.id}>
              <div className="card-thumb" aria-hidden="true">🛒</div>
              <div className="card-top"><span className="chip">{product.category}</span></div>
              <h3>{product.name}</h3>
              <p className="store">🏬 {product.storeName ?? 'Loja'}</p>
              <p className="desc">{product.description || 'Produto da comunidade UFSCar.'}</p>
              <p className={`stock ${product.inStock ? 'ok' : 'out'}`}>
                {product.inStock ? `Em estoque (${product.stockQty})` : 'Sem estoque'}
              </p>
              <div className="card-foot">
                <p className="price">{money(product.priceCents)}</p>
                <button
                  type="button"
                  disabled={!product.inStock || addingId === product.id || (Boolean(user) && user?.role !== 'BUYER')}
                  onClick={() => void addToCart(product)}
                >
                  {addingId === product.id ? 'Adicionando…' : 'Adicionar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
