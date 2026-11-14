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


## C06 — Catálogo e carrinho multivendedor

A entrega C06 disponibiliza o catálogo público e o carrinho para compradores autenticados. O carrinho reúne itens de diferentes lojas, agrupa a visualização por vendedor e calcula subtotais e total em centavos usando os preços atuais armazenados no banco.

### Rotas adicionadas para o carrinho

Todas exigem JWT de uma conta com perfil `BUYER`:

- `GET /api/cart` — consulta itens agrupados por loja, quantidade total e total em centavos.
- `POST /api/cart/items` — adiciona um produto; corpo JSON: `{"productId":"...","quantity":1}`. A quantidade é somada ao item existente.
- `PATCH /api/cart/items/:itemId` — define a quantidade; corpo JSON: `{"quantity":2}`.
- `DELETE /api/cart/items/:itemId` — remove um item do carrinho do comprador autenticado.

A API impede adicionar produtos inativos/indisponíveis e quantidades acima do estoque. Preços e subtotais são calculados no servidor. O catálogo inicial está disponível na rota `/` e a página do carrinho em `/carrinho`. O checkout não faz parte desta entrega; fica para C07.


## C07 — Checkout único

- `POST /api/orders/checkout`: cria um único pedido a partir dos itens do carrinho, recalcula os preços pelo banco, valida disponibilidade e estoque, agrupa itens por vendedor e limpa o carrinho somente quando o pedido é criado.
- `GET /api/orders`: lista os pedidos do comprador autenticado, com subtotais por loja e total geral.
- A compra é criada com status `PENDING_PAYMENT`; a simulação de pagamento e a baixa de estoque ficam fora desta entrega.
- Interface: botão **Finalizar compra** no carrinho e página **Meus pedidos**.
- Carrinho e checkout usam o mesmo filtro de disponibilidade: itens de produtos desativados (ou de vendedores não aprovados) não aparecem no carrinho e não entram no pedido, então o total exibido é o total do pedido.
- Testes unitários (`npm test` em `server/`): `cart.rules.test.ts` (CA04 totais do carrinho, CA05 itens e valores por vendedor) e `orders.rules.test.ts` (CA07 estoque no checkout).

## C09 — Acompanhamento dos pedidos e revisão de permissões

- `PATCH /api/seller/orders/:orderId/status` (vendedor): avança o andamento **somente da parte da sua loja** no pedido, um estado por vez: `CONFIRMED` (confirmado) → `PREPARING` (em preparação) → `READY_FOR_PICKUP` (disponível para retirada) → `COMPLETED` (concluído). Só vale para pedidos pagos; não permite pular, repetir ou voltar estados. Pedido sem itens da loja responde 404 (CA02).
- `GET /api/seller/orders` e `GET /api/orders` passam a informar o andamento de cada loja (`fulfillmentStatus`).
- Interface: coluna **Andamento** no painel do vendedor, com o botão da próxima etapa, e o andamento de cada loja em **Meus pedidos** (RF09 / CA09).
- Permissões: o perfil do usuário é lido do banco a cada requisição, e não do token. Assim, quem solicita ser vendedor deixa de usar as rotas de comprador na hora e, após a aprovação, acessa a loja sem precisar entrar de novo.
- Testes unitários: `orders.rules.test.ts` (CA09 transições do andamento).
