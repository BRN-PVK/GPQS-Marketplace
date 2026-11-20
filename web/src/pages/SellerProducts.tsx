import { useState } from 'react';
import { api, ApiError } from '../lib/api';

// D01 (RF03 / CA01): cadastro, edição e desativação de produtos pelo vendedor aprovado.
// A API já existe (POST/PATCH /seller/products e /deactivate, /activate); aqui fica a interface.

export type SellerProduct = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  stockQty: number;
  active: boolean;
};

type FormState = {
  name: string;
  description: string;
  price: string; // em reais, como o vendedor digita (ex.: "12,50")
  category: string;
  stockQty: string;
};

const EMPTY_FORM: FormState = { name: '', description: '', price: '', category: '', stockQty: '0' };

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

// Converte "12,50" ou "12.50" em centavos (1250), sem usar ponto flutuante.
// Retorna null quando o texto não é um valor em reais com até duas casas decimais.
export function parsePriceToCents(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [intPart, decPart = ''] = normalized.split('.');
  return Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
}

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function SellerProducts({
  products,
  onReload,
}: {
  products: SellerProduct[];
  onReload: () => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState('');

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setFormOpen(true);
  }

  function openEdit(p: SellerProduct) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description,
      price: centsToInput(p.priceCents),
      category: p.category,
      stockQty: String(p.stockQty),
    });
    setError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const priceCents = parsePriceToCents(form.price);
    if (priceCents === null || priceCents <= 0) {
      setError('Informe um preço maior que zero, com até duas casas decimais (ex.: 12,50).');
      return;
    }
    const stockQty = Number(form.stockQty);
    if (!Number.isInteger(stockQty) || stockQty < 0) {
      setError('A quantidade em estoque deve ser um número inteiro maior ou igual a zero.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      priceCents,
      category: form.category.trim(),
      stockQty,
    };

    setBusy(true);
    try {
      if (editingId) {
        await api(`/seller/products/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await api('/seller/products', { method: 'POST', body: JSON.stringify(payload) });
      }
      await onReload();
      closeForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o produto.');
    } finally {
      setBusy(false);
    }
  }

  // RF03: desativar (some do catálogo e dos novos carrinhos) e reativar.
  async function toggleActive(p: SellerProduct) {
    setTogglingId(p.id);
    setError('');
    try {
      await api(`/seller/products/${p.id}/${p.active ? 'deactivate' : 'activate'}`, { method: 'POST' });
      await onReload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : p.active
            ? 'Não foi possível desativar o produto.'
            : 'Não foi possível reativar o produto.',
      );
    } finally {
      setTogglingId('');
    }
  }

  return (
    <div>
      <div className="section-head">
        <p className="muted">Produtos desativados não aparecem no catálogo nem entram em novos pedidos.</p>
        {!formOpen && (
          <button type="button" onClick={openNew}>
            Novo produto
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={submit} className="form product-form">
          <h2>{editingId ? 'Editar produto' : 'Novo produto'}</h2>
          <label>
            Nome
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
              minLength={2}
            />
          </label>
          <label>
            Descrição
            <input
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              maxLength={2000}
            />
          </label>
          <div className="row">
            <label>
              Categoria
              <input
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                required
                minLength={2}
              />
            </label>
            <label>
              Preço (R$)
              <input
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </label>
            <label>
              Estoque
              <input
                type="number"
                min={0}
                step={1}
                value={form.stockQty}
                onChange={(e) => setField('stockQty', e.target.value)}
                required
              />
            </label>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" disabled={busy}>
              {busy ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
            <button type="button" className="btn-secondary" onClick={closeForm} disabled={busy}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!formOpen && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {products.length === 0 ? (
        <div className="empty">
          <p>Você ainda não cadastrou produtos. Use “Novo produto” para publicar o primeiro.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Preço Unitário</th>
              <th>Estoque Atual</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'inactive'}>
                <td>
                  <strong>{p.name}</strong>
                </td>
                <td>{p.category}</td>
                <td>{money(p.priceCents)}</td>
                <td>
                  <span style={{ fontWeight: 700, color: p.stockQty === 0 ? 'var(--danger)' : 'inherit' }}>
                    {p.stockQty} {p.stockQty === 1 ? 'unidade' : 'unidades'}
                  </span>
                </td>
                <td>
                  {!p.active ? (
                    <span className="badge rejected">Desativado</span>
                  ) : p.stockQty > 0 ? (
                    <span className="badge approved">Em estoque</span>
                  ) : (
                    <span className="badge rejected">Esgotado</span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn-link" onClick={() => openEdit(p)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className={p.active ? 'btn-link danger' : 'btn-link'}
                      disabled={togglingId === p.id}
                      onClick={() => void toggleActive(p)}
                    >
                      {togglingId === p.id ? 'Aguarde…' : p.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
