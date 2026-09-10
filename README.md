# Assistente Pessoal

Um assistente de IA pessoal (estilo Jarvis) que roda no seu PC e pode ser acessado
pelo celular. O agente conversa com você, gerencia sua rotina (tarefas, compromissos,
lembretes) e mantém memória de longo prazo sobre suas preferências e contexto — e
cobre as áreas que você pediu: finanças pessoais, financeiro da empresa, saúde
pessoal, patrimônio e triagem de oportunidades de negócio/investimento.

Todos os módulos abaixo estão implementados e funcionando. Veja [Roadmap](#roadmap)
para o que pode evoluir a partir daqui.

## Como funciona

- **Backend**: Node.js + Express, rodando localmente no seu PC.
- **Banco de dados**: SQLite (arquivo local em `data/assistant.db`), sem precisar
  instalar nada além do Node.
- **Agente de IA**: motor plugável, com *tool calling* — ou seja, o agente de
  verdade cria/consulta tarefas e salva memória, não só conversa. Padrão é
  **Google Gemini (gratuito)**; dá pra trocar para Groq (gratuito) ou
  Anthropic/Claude (pago) mudando uma variável no `.env`. Ver
  [Motor de IA](#motor-de-ia-gemini-gr%C3%A1tis-groq-gr%C3%A1tis-ou-anthropic-pago).
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
   - `GEMINI_API_KEY` (padrão, gratuito): gere em https://aistudio.google.com/apikey
     — veja [Motor de IA](#motor-de-ia-gemini-gr%C3%A1tis-groq-gr%C3%A1tis-ou-anthropic-pago)
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

#### Habilitando HTTPS (necessário para o microfone funcionar pelo celular)

Por padrão o acesso pelo IP da rede local é `http://`, sem HTTPS. Isso é
suficiente pra tudo, **exceto** o botão de falar no chat: os navegadores só
liberam o microfone em `https://` ou `localhost` — em `http://192.168.x.x`
o botão de voz não aparece. Pra resolver, é só usar o Tailscale, que expõe
seu servidor com HTTPS automático sem precisar mexer em nada no código:

```bash
# depois de instalar e logar no Tailscale no seu PC:
tailscale serve --bg 3001
```

Isso publica o assistente em `https://<nome-do-seu-pc>.<sua-tailnet>.ts.net`,
acessível de qualquer dispositivo com Tailscale instalado (inclusive o
celular), com certificado válido e o microfone liberado.

## Motor de IA: Gemini (grátis), Groq (grátis) ou Anthropic (pago)

O agente não está preso a um provedor — `server/providers/` tem uma implementação
para cada um, e `AI_PROVIDER` no `.env` escolhe qual usar. Todas seguem a mesma
interface, então trocar de provedor não muda nada no resto do código.

**Google Gemini (padrão, gratuito)**:
1. Entre com uma conta Google em https://aistudio.google.com.
2. Gere uma API key em https://aistudio.google.com/apikey.
3. No `.env`: `AI_PROVIDER=gemini` e `GEMINI_API_KEY=...`.
4. Roda o modelo Gemini 2.0 Flash por padrão (`GEMINI_MODEL`), com suporte a
   tool calling e tier gratuito generoso.

**Groq (alternativa gratuita)**:
1. Crie uma conta grátis em https://console.groq.com (não pede cartão de crédito).
2. Gere uma API key em https://console.groq.com/keys.
3. No `.env`: `AI_PROVIDER=groq` e `GROQ_API_KEY=gsk_...`.
4. Roda o modelo Llama 3.3 70B por padrão (`GROQ_MODEL`).

**Anthropic/Claude (opcional, pago)**:
1. Precisa de créditos em https://console.anthropic.com/settings/billing.
2. No `.env`: `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=sk-ant-...`.
3. Melhor qualidade de raciocínio e mais confiável no uso das ferramentas, mas
   cobra por uso.

Se um provedor gratuito der problema de login/conta, é só trocar o `AI_PROVIDER`
no `.env` para outro — o resto da plataforma continua igual.

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

## O que já funciona (Fase 2c — financeiro da empresa)

- Mesmo modelo de contas/transações/resumo das finanças pessoais, mas
  completamente isolado (`scope: "empresa"`) — nada se mistura com suas
  finanças pessoais.
- Aba "Empresa" separada no painel, com suas próprias contas, transações e
  resumo mensal por categoria.
- O agente também opera nos dois escopos pelo chat, e pergunta antes de
  registrar algo se não estiver claro se é pessoal ou da empresa.

## O que já funciona (Fase 2d — saúde pessoal)

- Registro livre de métricas de saúde (peso, sono, treino, pressão, humor,
  ou qualquer nome que você quiser usar), pelo painel ou pelo chat.
- Painel com a última leitura de cada métrica e um gráfico de tendência
  para a métrica selecionada.

## O que já funciona (Fase 2e — oportunidades de negócio/investimento)

- Board de oportunidades: título, categoria, valor estimado, status
  (analisando/em andamento/aprovada/descartada) e próximo passo.
- O agente registra e ajuda a triar oportunidades pelo chat, dando sua
  análise (prós, contras, riscos) com base no raciocínio dele e no que você
  contar na conversa.
- **Sem `TAVILY_API_KEY` configurada**: o agente avisa que não tem busca na
  web nem dados de mercado em tempo real, e nunca finge ter pesquisado algo.
- **Com `TAVILY_API_KEY` configurada** (Fase 4, ver abaixo): o agente
  pesquisa de verdade antes de opinar — preços, concorrência, notícias — e
  cita as fontes na resposta.

## O que já funciona (Fase 4 — busca real na web, opcional)

- Nova ferramenta `search_web`, só oferecida ao agente quando `TAVILY_API_KEY`
  está definida no `.env` — sem a chave, o comportamento continua o da Fase 2e
  (análise só por raciocínio, sem fingir ter pesquisado).
- Usa a [Tavily](https://tavily.com), uma API de busca feita para agentes de
  IA: 1000 créditos/mês grátis, **sem pedir cartão de crédito** (ao contrário
  da Brave Search, que passou a exigir cartão em 2026).
- Para ativar: crie uma conta grátis em https://tavily.com, gere uma API key,
  e coloque em `TAVILY_API_KEY` no `.env`. Não precisa reiniciar mais nada
  além do servidor.

## Roadmap

Todos os módulos pedidos inicialmente (finanças pessoais, financeiro da
empresa, saúde, patrimônio, oportunidades de negócio/investimento) estão
implementados, plugados no mesmo núcleo (agente + memória + rotina):

- [x] **Finanças pessoais**: contas, gastos, receitas, resumo por categoria.
- [x] **Patrimônio**: ativos, passivos, patrimônio líquido e evolução no tempo.
- [x] **Financeiro da empresa**: contas, receitas/despesas e resumo, isolado do pessoal.
- [x] **Saúde pessoal**: métricas livres (peso, sono, treino, pressão...) e tendência.
- [x] **Oportunidades de negócio/investimento**: registro, triagem, análise por
      raciocínio do agente, e busca real na web opcional via Tavily (Fase 4).

Próximas evoluções sugeridas (nenhuma delas obrigatória, mas onde investir se
quiser ir além):

- **Import automático de extrato bancário** (Open Finance/Pluggy, ou upload de
  CSV) em vez de lançar transações manualmente.
- **Notificações push** no celular para lembretes e o resumo matinal, em vez
  de só aparecer quando você abre o app.
- **Multiplos usuários/perfis**, caso um dia queira dar acesso a outra pessoa
  (hoje é single-user por design, de propósito, para manter simples).

## Estrutura do projeto

```
server/
  index.js        # entrada do servidor
  db.js           # schema SQLite
  auth.js         # login single-user + JWT
  agent.js        # orquestração do agente (system prompt + delega ao provider)
  providers/       # implementações por motor de IA, interface comum
    index.js          # getProvider() lê AI_PROVIDER do .env
    gemini.js            # provedor gratuito (Google Gemini, padrão)
    groq.js                 # provedor gratuito (Groq, alternativa)
    anthropic.js               # provedor pago (Claude)
  tools.js         # ferramentas que o agente pode executar
  finance.js         # lógica de contas/transações/resumo (usada por rotas e agente)
  patrimonio.js        # lógica de ativos/passivos/patrimônio líquido
  scheduler.js            # geração do resumo matinal (cron)
  routes/
    chat.js                    # POST /api/chat
    routine.js                   # tarefas, agenda de hoje, memória
    finance.js                     # factory de rotas de contas/transações/resumo,
                                    # montada duas vezes: /api/finance (pessoal) e
                                    # /api/company/finance (empresa)
    patrimonio.js                    # ativos, passivos, patrimônio líquido, histórico
    health.js                          # métricas de saúde, últimas leituras, tendência
    opportunities.js                     # board de oportunidades de negócio/investimento
    search.js                              # busca na web via Tavily (opcional)
public/
  index.html, app.js, styles.css   # frontend (chat + rotina + finanças + empresa +
                                    # patrimônio + saúde + oportunidades)
```
