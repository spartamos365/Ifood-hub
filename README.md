# Assistente Pessoal

Um assistente de IA pessoal (estilo Jarvis) que roda no seu PC e pode ser acessado
pelo celular. O agente conversa com você, gerencia sua rotina (tarefas, compromissos,
lembretes) e mantém memória de longo prazo sobre suas preferências e contexto.

Este é o **núcleo** da plataforma — a base sobre a qual os módulos de finanças,
saúde, patrimônio e busca de negócios serão construídos nas próximas fases (veja
[Roadmap](#roadmap)).

## Como funciona

- **Backend**: Node.js + Express, rodando localmente no seu PC.
- **Banco de dados**: SQLite (arquivo local em `data/assistant.db`), sem precisar
  instalar nada além do Node.
- **Agente de IA**: API da Anthropic (Claude), com *tool calling* — ou seja, o
  agente de verdade cria/consulta tarefas e salva memória, não só conversa.
- **Frontend**: página web simples (`public/`), sem build step, acessível pelo
  navegador do PC e do celular.
- **Autenticação**: login único (uso pessoal) com email/senha definidos no `.env`,
  protegido por JWT — importante porque o servidor fica acessível na sua rede.

## Como rodar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie o arquivo de exemplo de variáveis de ambiente e preencha:
   ```bash
   cp .env.example .env
   ```
   Você vai precisar de:
   - `ANTHROPIC_API_KEY`: gere em https://console.anthropic.com/settings/keys
   - `ASSISTANT_EMAIL` / `ASSISTANT_PASSWORD`: o login que você vai usar
   - `JWT_SECRET`: qualquer string aleatória longa
   - `USER_NAME`: seu nome, para o agente se dirigir a você
3. Rode o servidor:
   ```bash
   npm start
   ```
4. Acesse `http://localhost:3001` no navegador do seu PC.

### Acessar pelo celular

O celular precisa estar na **mesma rede Wi-Fi** que o PC (ou usar uma VPN tipo
[Tailscale](https://tailscale.com/) para acessar de fora de casa):

1. Descubra o IP local do seu PC (`ipconfig` no Windows, `ifconfig`/`ip a` no
   Linux/Mac — algo como `192.168.x.x`).
2. No celular, acesse `http://192.168.x.x:3001`.
3. Faça login com o email/senha do `.env`.

> Se quiser acessar de fora da sua rede local com segurança, use Tailscale (mais
> simples e seguro que abrir portas no roteador).

## O que já funciona (Fase 1 — núcleo)

- Chat com o agente, com memória de conversa.
- O agente cria tarefas/compromissos proativamente quando você menciona algo a
  fazer, sem precisar pedir explicitamente.
- O agente salva e recupera fatos importantes sobre você (preferências, rotina,
  objetivos) para lembrar em conversas futuras.
- Painel de rotina: tarefas de hoje, criação manual de tarefas, marcar como
  concluída.
- Resumo matinal automático (gerado todo dia às 7h, fuso configurável em
  `TIMEZONE`), ou sob demanda pelo botão "Gerar agora".

## O que já funciona (Fase 2a — finanças pessoais)

- Contas financeiras pessoais (conta corrente, poupança, carteira, cartão etc),
  com saldo atualizado automaticamente a cada transação.
- Registro de receitas e despesas, por categoria, pelo painel ou pelo chat — o
  agente registra proativamente quando você menciona um gasto/recebimento
  ("gastei 50 no mercado").
- Resumo financeiro do mês: saldo total, receitas, despesas e gastos por
  categoria, visível no painel de Finanças.

## O que já funciona (Fase 2b — patrimônio)

- Ativos (imóveis, veículos, investimentos) e passivos (dívidas,
  financiamentos), registrados pelo painel ou pelo chat.
- Patrimônio líquido calculado automaticamente: saldo das contas + ativos −
  passivos.
- Histórico de evolução do patrimônio líquido, com um snapshot salvo por dia
  e gráfico simples no painel de Patrimônio.

## Roadmap

A plataforma foi desenhada para crescer em módulos, todos plugados no mesmo
núcleo (agente + memória + rotina). O modelo de dados dessas próximas fases já
está no `server/db.js` (tabelas `finance_accounts`, `finance_transactions`,
`health_logs`, `assets`, `opportunities`), prontas para receber as rotas e
ferramentas do agente:

- [x] **Finanças pessoais**: contas, gastos, receitas, resumo por categoria.
- [x] **Patrimônio**: ativos, passivos, patrimônio líquido e evolução no tempo.
- [ ] **Financeiro da empresa**: fluxo de caixa, contas a pagar/receber, DRE simples.
- [ ] **Saúde pessoal**: hábitos, exames, métricas (sono, peso, treino), lembretes.
- [ ] **Busca de negócios/investimentos**: pesquisa e triagem de oportunidades,
      com o agente trazendo análises e recomendações.

Cada módulo será construído como: tabelas no banco (já reservadas) → rotas de API
→ novas ferramentas (`tools.js`) que o agente pode chamar → interface no frontend.

## Estrutura do projeto

```
server/
  index.js        # entrada do servidor
  db.js           # schema SQLite
  auth.js         # login single-user + JWT
  agent.js        # orquestração do agente Claude (system prompt + tool loop)
  tools.js         # ferramentas que o agente pode executar
  finance.js         # lógica de contas/transações/resumo (usada por rotas e agente)
  patrimonio.js        # lógica de ativos/passivos/patrimônio líquido
  scheduler.js            # geração do resumo matinal (cron)
  routes/
    chat.js                    # POST /api/chat
    routine.js                   # tarefas, agenda de hoje, memória
    finance.js                     # contas, transações, resumo financeiro
    patrimonio.js                    # ativos, passivos, patrimônio líquido, histórico
public/
  index.html, app.js, styles.css   # frontend (chat + rotina + finanças + patrimônio)
```
