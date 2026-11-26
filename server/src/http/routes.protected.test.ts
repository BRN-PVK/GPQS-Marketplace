import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../utils/jwt.js';
import type { Role } from '../types.js';

// D04: Testes de integração das rotas protegidas e isolamento de acesso por perfil (RF01, RF02, CA01, CA02).
describe('D04 - Testes de integração das rotas protegidas (autenticação e autorização)', () => {
  let server: Server;
  let baseUrl: string;

  let adminToken: string;
  let buyerToken: string;
  let sellerToken: string;
  let seller2Token: string;
  let pendingSellerToken: string;

  let sellerProduct: { id: string; sellerId: string };
  let seller2Product: { id: string; sellerId: string };

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Garante que os usuários de teste estejam presentes no banco
    const admin = await ensureUser('admin@marketplace.ufscar', 'Administrador', 'ADMIN');
    const buyer = await ensureUser('comprador@teste.com', 'Comprador Teste', 'BUYER');
    const seller = await ensureUser(
      'vendedor@teste.com',
      'Vendedor Aprovado',
      'SELLER',
      'APPROVED',
      'Papelaria Universitária',
    );
    const seller2 = await ensureUser(
      'vendedor2@teste.com',
      'Vendedor Tech',
      'SELLER',
      'APPROVED',
      'Tech UFSCar',
    );
    const pending = await ensureUser(
      'pendente@teste.com',
      'Vendedor Pendente',
      'SELLER',
      'PENDING',
      'Loja Aguardando Aprovação',
    );

    adminToken = signToken({ sub: admin.id, role: 'ADMIN', name: admin.name });
    buyerToken = signToken({ sub: buyer.id, role: 'BUYER', name: buyer.name });
    sellerToken = signToken({ sub: seller.id, role: 'SELLER', name: seller.name });
    seller2Token = signToken({ sub: seller2.id, role: 'SELLER', name: seller2.name });
    pendingSellerToken = signToken({ sub: pending.id, role: 'SELLER', name: pending.name });

    // Busca ou cria produtos de cada vendedor para teste de propriedade (CA02)
    sellerProduct = await ensureProduct(seller.seller!.id, 'Caderno Teste');
    seller2Product = await ensureProduct(seller2.seller!.id, 'Mouse Teste');
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  async function req(
    path: string,
    options: { method?: string; token?: string; body?: unknown } = {},
  ) {
    const headers: Record<string, string> = {};
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, data };
  }

  describe('1. Tentativas sem token ou com token inválido (401 - Não autenticado)', () => {
    const protectedRoutes = [
      { path: '/api/cart', method: 'GET' },
      { path: '/api/orders', method: 'GET' },
      { path: '/api/seller/orders', method: 'GET' },
      { path: '/api/seller/products', method: 'GET' },
      { path: '/api/sellers/me', method: 'PATCH', body: { storeName: 'Nova Loja' } },
      { path: '/api/admin/sellers', method: 'GET' },
      { path: '/api/admin/commissions', method: 'GET' },
    ];

    for (const route of protectedRoutes) {
      it(`rejeita ${route.method} ${route.path} sem cabeçalho Authorization com 401`, async () => {
        const { status, data } = await req(route.path, { method: route.method, body: route.body });
        expect(status).toBe(401);
        expect(data?.error).toBe('Autenticação necessária.');
      });
    }

    it('rejeita token com formato incorreto (sem prefixo Bearer) com 401', async () => {
      const res = await fetch(`${baseUrl}/api/cart`, {
        headers: { Authorization: buyerToken },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Autenticação necessária.');
    });

    it('rejeita token adulterado ou expirado com 401', async () => {
      const { status, data } = await req('/api/cart', { token: 'token-invalido-123' });
      expect(status).toBe(401);
      expect(data?.error).toBe('Token inválido ou expirado.');
    });

    it('rejeita token assinado com sub de usuário que não existe no banco com 401', async () => {
      const fakeToken = signToken({ sub: 'id-inexistente', role: 'BUYER', name: 'Fantasma' });
      const { status, data } = await req('/api/cart', { token: fakeToken });
      expect(status).toBe(401);
      expect(data?.error).toBe('Token inválido ou expirado.');
    });
  });

  describe('2. Isolamento de acesso por perfil (403 - Acesso negado para este perfil)', () => {
    describe('Comprador (BUYER)', () => {
      it('permite acesso a rotas exclusivas de comprador (/cart e /orders)', async () => {
        const cartRes = await req('/api/cart', { token: buyerToken });
        expect(cartRes.status).toBe(200);

        const ordersRes = await req('/api/orders', { token: buyerToken });
        expect(ordersRes.status).toBe(200);
      });

      it('bloqueia comprador de acessar rotas de vendedor com 403', async () => {
        const productsRes = await req('/api/seller/products', { token: buyerToken });
        expect(productsRes.status).toBe(403);
        expect(productsRes.data?.error).toBe('Acesso negado para este perfil.');

        const ordersRes = await req('/api/seller/orders', { token: buyerToken });
        expect(ordersRes.status).toBe(403);
        expect(ordersRes.data?.error).toBe('Acesso negado para este perfil.');

        const updateRes = await req('/api/sellers/me', {
          method: 'PATCH',
          token: buyerToken,
          body: { storeName: 'Loja Hacker' },
        });
        expect(updateRes.status).toBe(403);
      });

      it('bloqueia comprador de acessar rotas de administrador com 403', async () => {
        const sellersRes = await req('/api/admin/sellers', { token: buyerToken });
        expect(sellersRes.status).toBe(403);
        expect(sellersRes.data?.error).toBe('Acesso negado para este perfil.');

        const commRes = await req('/api/admin/commissions', { token: buyerToken });
        expect(commRes.status).toBe(403);
        expect(commRes.data?.error).toBe('Acesso negado para este perfil.');
      });
    });

    describe('Vendedor (SELLER)', () => {
      it('permite acesso a rotas exclusivas de vendedor (/seller/products, /seller/orders)', async () => {
        const productsRes = await req('/api/seller/products', { token: sellerToken });
        expect(productsRes.status).toBe(200);

        const ordersRes = await req('/api/seller/orders', { token: sellerToken });
        expect(ordersRes.status).toBe(200);
      });

      it('bloqueia vendedor de acessar rotas exclusivas de comprador (/cart e /orders) com 403', async () => {
        const cartRes = await req('/api/cart', { token: sellerToken });
        expect(cartRes.status).toBe(403);
        expect(cartRes.data?.error).toBe('Acesso negado para este perfil.');

        const ordersRes = await req('/api/orders', { token: sellerToken });
        expect(ordersRes.status).toBe(403);
        expect(ordersRes.data?.error).toBe('Acesso negado para este perfil.');
      });

      it('bloqueia vendedor de acessar rotas de administrador com 403', async () => {
        const sellersRes = await req('/api/admin/sellers', { token: sellerToken });
        expect(sellersRes.status).toBe(403);
        expect(sellersRes.data?.error).toBe('Acesso negado para este perfil.');

        const commRes = await req('/api/admin/commissions', { token: sellerToken });
        expect(commRes.status).toBe(403);
        expect(commRes.data?.error).toBe('Acesso negado para este perfil.');
      });
    });

    describe('Administrador (ADMIN)', () => {
      it('permite acesso a rotas exclusivas de administrador (/admin/sellers, /admin/commissions)', async () => {
        const sellersRes = await req('/api/admin/sellers', { token: adminToken });
        expect(sellersRes.status).toBe(200);

        const commRes = await req('/api/admin/commissions', { token: adminToken });
        expect(commRes.status).toBe(200);
      });

      it('bloqueia administrador de acessar rotas exclusivas de comprador com 403', async () => {
        const cartRes = await req('/api/cart', { token: adminToken });
        expect(cartRes.status).toBe(403);
        expect(cartRes.data?.error).toBe('Acesso negado para este perfil.');

        const ordersRes = await req('/api/orders', { token: adminToken });
        expect(ordersRes.status).toBe(403);
        expect(ordersRes.data?.error).toBe('Acesso negado para este perfil.');
      });

      it('bloqueia administrador de acessar rotas de vendedor com 403', async () => {
        const productsRes = await req('/api/seller/products', { token: adminToken });
        expect(productsRes.status).toBe(403);
        expect(productsRes.data?.error).toBe('Acesso negado para este perfil.');
      });
    });
  });

  describe('3. Regras de isolamento de vendedores e integridade (CA01 e CA02)', () => {
    it('CA01: vendedor pendente não pode publicar produto (403)', async () => {
      const { status, data } = await req('/api/seller/products', {
        method: 'POST',
        token: pendingSellerToken,
        body: {
          name: 'Produto Pendente',
          description: 'Teste',
          priceCents: 1000,
          category: 'Papelaria',
          stockQty: 5,
        },
      });
      expect(status).toBe(403);
      expect(data?.error).toBe('Vendedor não aprovado não pode gerenciar produtos.');
    });

    it('CA02: vendedor não consegue alterar produtos pertencentes a outro vendedor (403)', async () => {
      // Vendedor 1 tenta alterar o produto do Vendedor 2
      const { status, data } = await req(`/api/seller/products/${seller2Product.id}`, {
        method: 'PATCH',
        token: sellerToken,
        body: { name: 'Nome Invasor' },
      });
      expect(status).toBe(403);
      expect(data?.error).toBe('Você só pode alterar seus próprios produtos.');
    });

    it('CA02: vendedor não consegue desativar produto pertencente a outro vendedor (403)', async () => {
      const { status, data } = await req(`/api/seller/products/${seller2Product.id}/deactivate`, {
        method: 'POST',
        token: sellerToken,
      });
      expect(status).toBe(403);
      expect(data?.error).toBe('Você só pode alterar seus próprios produtos.');
    });

    it('CA02: vendedor não consegue avançar andamento de pedido que não contém produtos de sua loja (404)', async () => {
      const { status, data } = await req('/api/seller/orders/pedido-inexistente-123/status', {
        method: 'PATCH',
        token: sellerToken,
        body: { status: 'PREPARING' },
      });
      expect(status).toBe(404);
      expect(data?.error).toBe('Pedido não encontrado.');
    });
  });

  describe('4. Rotas públicas e tratamento de rotas não mapeadas', () => {
    it('permite acesso a /api/health sem autenticação (200)', async () => {
      const { status, data } = await req('/api/health');
      expect(status).toBe(200);
      expect(data?.status).toBe('ok');
    });

    it('permite consulta ao catálogo público /api/products sem autenticação (200)', async () => {
      const { status, data } = await req('/api/products');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('permite consulta a categorias /api/categories sem autenticação (200)', async () => {
      const { status, data } = await req('/api/categories');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('responde 404 para rotas não mapeadas na API', async () => {
      const { status, data } = await req('/api/endpoint-inexistente');
      expect(status).toBe(404);
      expect(data?.error).toBe('Rota não encontrada.');
    });
  });
});

// Funções auxiliares para fixtures
async function ensureUser(
  email: string,
  name: string,
  role: Role,
  sellerStatus?: string,
  storeName?: string,
) {
  let user = await prisma.user.findUnique({ where: { email }, include: { seller: true } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: 'hash-teste-123',
        role,
        ...(sellerStatus
          ? {
              seller: {
                create: { storeName: storeName ?? `Loja ${name}`, status: sellerStatus },
              },
            }
          : {}),
      },
      include: { seller: true },
    });
  }
  return user;
}

async function ensureProduct(sellerId: string, name: string) {
  let product = await prisma.product.findFirst({ where: { sellerId, name } });
  if (!product) {
    product = await prisma.product.create({
      data: {
        sellerId,
        name,
        description: 'Produto para teste de integração',
        priceCents: 1500,
        category: 'Testes',
        stockQty: 10,
        active: true,
      },
    });
  }
  return { id: product.id, sellerId: product.sellerId };
}
