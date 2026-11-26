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

| Perfil                         | E-mail                   |
|--------------------------------|--------------------------|
| Administrador                  | admin@marketplace.ufscar |
| Comprador                      | comprador@teste.com      |
| Vendedor 1 (Papelaria Univ.)   | vendedor@teste.com       |
| Vendedor 2 (Tech UFSCar)       | vendedor2@teste.com      |
| Vendedor pendente              | pendente@teste.com       |


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


## C08 — Pagamento simulado, estoque e comissões

A entrega C08 conclui o ciclo de compra do marketplace com simulação de pagamento, controle atômico de estoque e registro das comissões da plataforma preservadas no momento da confirmação.

### Rotas adicionadas e aprimoradas

- `POST /api/orders/:id/pay`: processa a simulação de pagamento pelo comprador autenticado (perfil `BUYER`). Corpo JSON opcional: `{"result":"APPROVED"}` (padrão) ou `{"result":"REJECTED"}`.
  - **APPROVED:** valida se o estoque atual cobre os produtos, decrementa o estoque de cada item comprado de forma atômica no banco, calcula a comissão retida pelo marketplace para cada vendedor do pedido (`calculateOrderCommissions` com arredondamento half-up), cria os registros em `Commission` e `Payment`, e atualiza o status do pedido para `CONFIRMED`.
  - **REJECTED:** registra o pagamento com status `REJECTED` e atualiza o pedido para `REJECTED`, sem alteração de estoque e sem geração de comissões.
- `GET /api/orders`: aprimorada para retornar o objeto `payment` (resultado e timestamp), permitindo aos compradores acompanhar a confirmação imediata.
- `GET /api/seller/orders`: extrato de vendas da loja do vendedor autenticado (perfil `SELLER`), detalhando total de vendas brutas confirmadas, taxa retida pelo marketplace (10%), valor líquido a receber e histórico de pedidos.
- `GET /api/admin/commissions`: extrato financeiro para o administrador (perfil `ADMIN`), consolidando o volume bruto transacionado e o total arrecadado em comissões pela plataforma.

### Interface

- **Meus Pedidos (`/pedidos`):** painel com botões para **Simular Pagamento Aprovado** ou **Simular Recusa**, além de badges visuais para pedidos aguardando, confirmados e recusados.
- **Painel do Vendedor (`/vendedor`):** cards de métricas financeiras (Vendas Brutas, Comissão da Plataforma e Valor Líquido), extrato de vendas e aba com estoque em tempo real dos produtos da loja.
- **Painel Administrativo (`/admin`):** aba com extrato consolidado das comissões do marketplace discriminadas por pedido e loja.

### Testes unitários (`npm test` em `server/`)

- `orders.rules.test.ts`:
  - CA08: cálculo de comissões de múltiplos vendedores em uma única compra (cenário de R$ 100,00 da Loja 1 e R$ 50,00 da Loja 2 com 10% de taxa).
  - Arredondamento half-up para frações de centavo.
  - Validação de estoque suficiente vs insuficiente no momento do pagamento.


## C09 — Acompanhamento dos pedidos e revisão de permissões

- `PATCH /api/seller/orders/:orderId/status` (vendedor): avança o andamento **somente da parte da sua loja** no pedido, um estado por vez: `CONFIRMED` (confirmado) → `PREPARING` (em preparação) → `READY_FOR_PICKUP` (disponível para retirada) → `COMPLETED` (concluído). Só vale para pedidos pagos; não permite pular, repetir ou voltar estados. Pedido sem itens da loja responde 404 (CA02).
- `GET /api/seller/orders` e `GET /api/orders` passam a informar o andamento de cada loja (`fulfillmentStatus`).
- Interface: coluna **Andamento** no painel do vendedor, com o botão da próxima etapa, e o andamento de cada loja em **Meus pedidos** (RF09 / CA09).
- Permissões: o perfil do usuário é lido do banco a cada requisição, e não do token. Assim, quem solicita ser vendedor deixa de usar as rotas de comprador na hora e, após a aprovação, acessa a loja sem precisar entrar de novo.
- Testes unitários: `orders.rules.test.ts` (CA09 transições do andamento).
