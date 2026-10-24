# Marketplace UFSCar

Marketplace multivendedor desenvolvido na disciplina GPQS.

**Equipe:** Alisson, Nicolas e Bruno · **Stack:** React + Node + TypeScript + Prisma (SQLite)

## Como executar

Requer Node.js 18+. Use dois terminais.

**API**

```bash
cd server
npm install
cp .env.example .env    # Windows: copy .env.example .env
npm run setup           # cria o banco e os dados de demonstração
npm run dev             # http://localhost:3333
```

**Frontend**

```bash
cd web
npm install
npm run dev             # http://localhost:5173
```

## Contas de demonstração

Senha de todas: `senha123`

| Perfil            | E-mail                   |
|-------------------|--------------------------|
| Administrador     | admin@marketplace.ufscar |
| Comprador         | comprador@teste.com      |
| Vendedor aprovado | vendedor@teste.com       |
| Vendedor pendente | pendente@teste.com       |
