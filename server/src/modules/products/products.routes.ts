import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../http/AppError.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { authenticate, authorize } from '../../http/middleware/auth.js';
import { canSellerPublish, isProductOwner } from './products.rules.js';

export const productsRouter = Router();

const productSchema = z.object({
  name: z.string().min(2, 'Nome do produto muito curto.'),
  description: z.string().max(2000).optional().default(''),
  priceCents: z.number().int().positive('Preço deve ser positivo (em centavos).'),
  category: z.string().min(2, 'Categoria obrigatória.'),
  stockQty: z.number().int().min(0, 'Estoque não pode ser negativo.'),
});

const updateSchema = productSchema.partial();

// ---------- Catálogo público (RF04 / CA03) ----------

// GET /products?q=&category= -> somente produtos ATIVOS.
productsRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const category =
      typeof req.query.category === 'string' ? req.query.category.trim() : undefined;

    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(q ? { name: { contains: q } } : {}),
        ...(category ? { category } : {}),
      },
      include: { seller: { select: { storeName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(products.map(toPublicProduct));
  }),
);

// Lista de categorias existentes (apoio ao filtro no front).
productsRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.product.findMany({
      where: { active: true },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    res.json(rows.map((r) => r.category));
  }),
);

// Detalhe de um produto ativo.
productsRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, active: true },
      include: { seller: { select: { storeName: true } } },
    });
    if (!product) throw new AppError('Produto não encontrado.', 404);
    res.json(toPublicProduct(product));
  }),
);

// ---------- Área do vendedor (RF03 / CA01 / CA02) ----------

// Lista os produtos do próprio vendedor (inclui inativos).
productsRouter.get(
  '/seller/products',
  authenticate,
  authorize('SELLER'),
  asyncHandler(async (req, res) => {
    const seller = await getSeller(req.user!.sub);
    const products = await prisma.product.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products.map(toSellerProduct));
  }),
);

// Cadastra produto - somente vendedor APROVADO (CA01).
productsRouter.post(
  '/seller/products',
  authenticate,
  authorize('SELLER'),
  asyncHandler(async (req, res) => {
    const seller = await getApprovedSeller(req.user!.sub);
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data: { ...data, sellerId: seller.id } });
    res.status(201).json(toSellerProduct(product));
  }),
);

// Edita produto próprio (CA02).
productsRouter.patch(
  '/seller/products/:id',
  authenticate,
  authorize('SELLER'),
  asyncHandler(async (req, res) => {
    const seller = await getApprovedSeller(req.user!.sub);
    const product = await getOwnedProduct(req.params.id, seller.id);
    const data = updateSchema.parse(req.body);
    const updated = await prisma.product.update({ where: { id: product.id }, data });
    res.json(toSellerProduct(updated));
  }),
);

// Desativa produto próprio (RF03: desativar).
productsRouter.post(
  '/seller/products/:id/deactivate',
  authenticate,
  authorize('SELLER'),
  asyncHandler(async (req, res) => {
    const seller = await getApprovedSeller(req.user!.sub);
    const product = await getOwnedProduct(req.params.id, seller.id);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { active: false },
    });
    res.json(toSellerProduct(updated));
  }),
);

// Reativa produto próprio.
productsRouter.post(
  '/seller/products/:id/activate',
  authenticate,
  authorize('SELLER'),
  asyncHandler(async (req, res) => {
    const seller = await getApprovedSeller(req.user!.sub);
    const product = await getOwnedProduct(req.params.id, seller.id);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { active: true },
    });
    res.json(toSellerProduct(updated));
  }),
);

// ---------- helpers ----------

async function getSeller(userId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw new AppError('Perfil de vendedor não encontrado.', 404);
  return seller;
}

async function getApprovedSeller(userId: string) {
  const seller = await getSeller(userId);
  if (!canSellerPublish(seller.status)) {
    throw new AppError('Vendedor não aprovado não pode gerenciar produtos.', 403);
  }
  return seller;
}

async function getOwnedProduct(productId: string, sellerId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Produto não encontrado.', 404);
  if (!isProductOwner(product.sellerId, sellerId)) {
    throw new AppError('Você só pode alterar seus próprios produtos.', 403);
  }
  return product;
}

function toPublicProduct(p: {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  stockQty: number;
  seller?: { storeName: string };
}) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    category: p.category,
    stockQty: p.stockQty,
    inStock: p.stockQty > 0,
    storeName: p.seller?.storeName ?? null,
  };
}

function toSellerProduct(p: {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  stockQty: number;
  active: boolean;
}) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    category: p.category,
    stockQty: p.stockQty,
    active: p.active,
  };
}
