import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Senha única para todas as contas de demonstração (dados fictícios).
const DEMO_PASSWORD = 'senha123';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Limpa dados (ordem respeita as FKs).
  await prisma.commission.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.user.deleteMany();

  // Administrador (previamente cadastrado - RF01)
  await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@marketplace.ufscar',
      passwordHash,
      role: 'ADMIN',
    },
  });

  // Comprador
  await prisma.user.create({
    data: { name: 'Comprador Teste', email: 'comprador@teste.com', passwordHash, role: 'BUYER' },
  });

  // Vendedor APROVADO 1, com produtos (Papelaria Universitária)
  const sellerAprovado = await prisma.user.create({
    data: {
      name: 'Vendedor Aprovado',
      email: 'vendedor@teste.com',
      passwordHash,
      role: 'SELLER',
      seller: {
        create: { storeName: 'Papelaria Universitária', status: 'APPROVED' },
      },
    },
    include: { seller: true },
  });

  // Vendedor APROVADO 2, com produtos (Tech UFSCar) - Viabiliza demonstração de CA05 e CA08
  const sellerAprovado2 = await prisma.user.create({
    data: {
      name: 'Vendedor Tech',
      email: 'vendedor2@teste.com',
      passwordHash,
      role: 'SELLER',
      seller: {
        create: { storeName: 'Tech UFSCar', status: 'APPROVED' },
      },
    },
    include: { seller: true },
  });

  // Vendedor PENDENTE (não pode publicar - CA01)
  await prisma.user.create({
    data: {
      name: 'Vendedor Pendente',
      email: 'pendente@teste.com',
      passwordHash,
      role: 'SELLER',
      seller: { create: { storeName: 'Loja Aguardando Aprovação', status: 'PENDING' } },
    },
  });

  // Produtos do vendedor aprovado 1 (Papelaria)
  const sellerId1 = sellerAprovado.seller!.id;
  await prisma.product.createMany({
    data: [
      {
        sellerId: sellerId1,
        name: 'Caderno Universitário 200 folhas',
        description: 'Caderno espiral, capa dura.',
        priceCents: 2990,
        category: 'Papelaria',
        stockQty: 50,
      },
      {
        sellerId: sellerId1,
        name: 'Caneta Esferográfica Azul (cx 50)',
        description: 'Caixa com 50 canetas.',
        priceCents: 4500,
        category: 'Papelaria',
        stockQty: 20,
      },
      {
        sellerId: sellerId1,
        name: 'Bloco de Notas Adesivas',
        description: 'Bloco com 100 folhas coloridas.',
        priceCents: 1000,
        category: 'Papelaria',
        stockQty: 15,
      },
    ],
  });

  // Produtos do vendedor aprovado 2 (Eletrônicos e Informática)
  const sellerId2 = sellerAprovado2.seller!.id;
  await prisma.product.createMany({
    data: [
      {
        sellerId: sellerId2,
        name: 'Calculadora Científica',
        description: '240 funções para engenharia e exatas.',
        priceCents: 8990,
        category: 'Eletrônicos',
        stockQty: 8,
      },
      {
        sellerId: sellerId2,
        name: 'Mouse Sem Fio Ergonômico',
        description: 'Conexão USB 2.4GHz com pilha inclusa.',
        priceCents: 5000,
        category: 'Eletrônicos',
        stockQty: 12,
      },
      {
        sellerId: sellerId2,
        name: 'Fone de Ouvido com Fio',
        description: 'Fone intra-auricular com microfone.',
        priceCents: 3500,
        category: 'Eletrônicos',
        stockQty: 0, // sem estoque (demonstra "inStock: false")
      },
    ],
  });

  console.log('Seed concluído.');
  console.log(`Senha de todas as contas de demonstração: ${DEMO_PASSWORD}`);
  console.log('Contas:');
  console.log('  admin@marketplace.ufscar  (ADMIN)');
  console.log('  comprador@teste.com       (BUYER)');
  console.log('  vendedor@teste.com        (SELLER aprovado - Papelaria Universitária)');
  console.log('  vendedor2@teste.com       (SELLER aprovado - Tech UFSCar)');
  console.log('  pendente@teste.com        (SELLER pendente)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
