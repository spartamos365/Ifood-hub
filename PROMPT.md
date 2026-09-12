# Especificação: Assistente Pessoal de IA (estilo Jarvis)

Este documento reconstrói o pedido original e todas as decisões tomadas ao
longo do desenvolvimento, para que outra IA (ou você mesmo) possa continuar,
reconstruir ou reimplementar este projeto do zero.

---

## 1. Pedido original (visão do produto)

> Quero uma plataforma com um assistente pessoal de IA, no estilo do JARVIS
> do Homem de Ferro, que me ajude em toda a minha trajetória: organizar,
> planejar, aconselhar e executar. Esse assistente deve tomar conta de:
>
> - Finanças pessoais
> - Financeiro da empresa
> - Saúde pessoal
> - Patrimônio
> - Busca de novos negócios para investir e ganhar mais dinheiro
>
> Deve atender minha rotina no dia a dia e gerir tudo. Quero rodar isso no
> meu PC pessoal, e poder me comunicar com ele pelo celular também.

Requisitos adicionados depois, ao longo do uso:

- Motor de IA **gratuito** (sem custo de API) — tentar Groq, depois Gemini
  como principal (Groq deu problema de login).
- Acesso pelo celular mesmo fora da rede Wi-Fi de casa (4G) → usar Tailscale.
- Entrada por voz (falar com o assistente) e depois **saída por voz** (o
  assistente falar de volta) — experiência de voz bidirecional.
- Enviar **foto de recibo/nota fiscal** pro assistente ler e registrar o
  gasto sozinho (sem digitar nada).
- Personalidade mais "premium"/confiante, no estilo Jarvis — não soar como
  chatbot de suporte genérico.
- Um painel único de "Visão Geral" mostrando todos os indicadores da vida
  (patrimônio, saldo, tarefas do dia, saúde, oportunidades) num só lugar,
  inspirado visualmente em dashboards industriais tipo "torre de controle".
- Import de extrato bancário via CSV (pesquisamos Open Finance/Pluggy, mas
  isso exige conta de desenvolvedor e plano pago pra produção — inviável
  pra uso pessoal agora).
- Visual mais futurista/sci-fi (glow, gradientes), inspirado em imagens de
  referência de IA e dashboards escuros com neon.
- Eventual intenção de **vender essa solução** no futuro (ainda não
  desenvolvido — ver seção "Não implementado ainda").

---

## 2. Decisões de arquitetura e por quê

| Decisão | Motivo |
|---|---|
| **Node.js + Express** | Simples de rodar localmente, sem servidor complexo. |
| **SQLite via `node:sqlite`** (built-in do Node, não `better-sqlite3`) | `better-sqlite3` é um módulo nativo que exige compilar C++ na instalação — trava no Windows sem Visual Studio Build Tools instalado (aconteceu na prática). `node:sqlite` é embutido no Node 22.13+, zero compilação. |
| **Motor de IA plugável** (`server/providers/`) | Começou com Anthropic (pago, usuário sem créditos), tentou Groq (login travou), foi pra Gemini (gratuito, funcionou). Arquitetura com `AI_PROVIDER` no `.env` e uma interface comum (`runConversation`, `complete`) pra trocar de provedor sem mexer no resto do código. |
| **Gemini com tool calling nativo** | Formato de function calling do Gemini é diferente do da Anthropic/OpenAI — foi preciso um adaptador específico (`toGeminiTools`). Detalhe importante: respostas com `functionCall` carregam um campo `thoughtSignature` que precisa ser reenviado inalterado pro tool calling funcionar (bug real encontrado: sem isso, a API retorna erro 400). |
| **Modelo `gemini-3.5-flash-lite`** (não `gemini-3.6-flash`) | O modelo "cheio" tem cota gratuita diária de só ~20 requisições/dia na prática (bem abaixo do que a documentação sugere) — o "lite" tem cota bem maior, melhor pra uso contínuo. |
| **Login single-user com JWT** | Uso 100% pessoal, mas o servidor fica exposto na rede (Wi-Fi/Tailscale), então precisa de autenticação mesmo sendo uma pessoa só. Login/senha vêm do `.env`. |
| **Tailscale pra acesso remoto/HTTPS** | Acesso pelo IP local (`http://192.168.x.x`) só funciona na mesma Wi-Fi. `tailscale serve` expõe com HTTPS automático (certificado válido), o que também é **obrigatório** pra Web Speech API (microfone) funcionar fora de `localhost`. |
| **Tavily pra busca na web** (não Brave/SerpAPI) | Brave removeu o tier gratuito sem cartão em 2026. SerpAPI só dá 100-250 buscas/mês grátis. Tavily dá 1000 créditos/mês grátis, sem cartão, e é feita pra ser consumida por agentes de IA. |
| **CSV em vez de Open Finance/Pluggy** pro import de extrato | Open Finance/Pluggy/Belvo exigem conta de desenvolvedor e plano pago pra uso em produção — CSV é grátis e funciona hoje. |
| **Web Speech API nativa** (não uma API paga tipo ElevenLabs) | `SpeechRecognition` (entrada) e `SpeechSynthesis` (saída) são nativas do navegador, gratuitas, sem chave de API. Limitação: exigem contexto seguro (HTTPS ou `localhost`) — daí a necessidade do Tailscale. |
| **Orb animado em vez de imagem/vídeo do assistente** | Ao pedir uma representação visual do assistente "falando", optei por um avatar animado em CSS/SVG (anéis girando, núcleo pulsante que muda de cor conforme o estado: ouvindo/pensando/falando) em vez de tentar embutir uma imagem estática de referência, que ficaria deslocada da interface real. |

---

## 3. Estrutura do projeto

```
server/
  index.js          # entrada do servidor Express
  db.js             # schema SQLite (node:sqlite)
  auth.js           # login single-user + JWT
  agent.js          # orquestra o agente: system prompt + delega ao provider
  providers/
    index.js          # getProvider() lê AI_PROVIDER do .env
    gemini.js            # padrão, gratuito
    groq.js                 # alternativa gratuita
    anthropic.js               # pago
  tools.js          # ferramentas (function calling) que o agente pode executar
  finance.js        # contas/transações/resumo (pessoal + empresa via "scope")
  patrimonio.js     # ativos/passivos/patrimônio líquido/histórico
  health.js         # métricas de saúde livres
  opportunities.js  # board de oportunidades de negócio/investimento
  search.js         # busca na web via Tavily (opcional)
  csv-import.js     # parser de CSV pra import de extrato
  scheduler.js      # cron do resumo matinal
  routes/
    chat.js, routine.js, finance.js (factory), patrimonio.js, health.js, opportunities.js
public/
  index.html, app.js, styles.css   # frontend single-page, sem build step
data/
  assistant.db      # banco SQLite (não versionado)
```

---

## 4. Módulos implementados (detalhado)

### 4.1 Núcleo do agente
- Chat com memória de conversa (histórico salvo em `conversations`/`messages`).
- Memória de longo prazo: o agente salva fatos/preferências (`remember`) e
  busca depois (`recall`) — tabela `memory_notes`.
- **Personalidade**: system prompt instrui o agente a ser confiante, direto,
  proativo (comentar padrões nos dados sem esperar pergunta), ter opinião
  quando pedida, tratar o usuário pelo nome, e nunca soar como chatbot de
  suporte genérico. Isso é 100% texto — ajustável em `server/agent.js`.
- Resumo matinal automático (cron às 7h) com as tarefas do dia.

### 4.2 Rotina
- Tarefas/compromissos: título, categoria, prioridade, prazo, recorrência.
- Agenda de hoje = pendentes com prazo hoje/sem prazo **+** concluídas hoje
  (importante: se filtrar só pendentes, tarefas concluídas somem da lista
  em vez de aparecer riscadas — bug real que corrigimos).
- Agente cria tarefas proativamente quando o usuário menciona algo a fazer.

### 4.3 Finanças (pessoal + empresa)
- Contas (corrente, poupança, cartão etc), transações (positivo = receita,
  negativo = despesa), resumo por período com breakdown por categoria.
- Pessoal e empresa são o **mesmo código**, parametrizado por `scope`
  ('pessoal'/'empresa') — uma factory de rotas montada duas vezes
  (`/api/finance` e `/api/company/finance`), evitando duplicar lógica.
- Import de extrato via CSV: formato `data,descricao,valor,categoria`,
  aceita `,` ou `;`, datas ISO ou BR, dedup estrito por
  conta+descrição+valor+data pra não duplicar se reimportar o mesmo arquivo.
- Agente registra gastos/receitas proativamente quando o usuário menciona
  ("gastei 50 no mercado").

### 4.4 Patrimônio
- Ativos (imóveis, veículos, investimentos) e passivos (dívidas).
- Patrimônio líquido = saldo das contas pessoais + ativos − passivos.
- Snapshot diário pra ver evolução no tempo (gráfico sparkline).

### 4.5 Saúde
- Métricas livres (peso, sono, treino, pressão, humor, o que o usuário quiser),
  cada uma com nome/valor/nota/data.
- Última leitura de cada métrica + histórico/tendência por métrica.

### 4.6 Oportunidades de negócio/investimento
- Board: título, categoria, valor estimado, status (analisando/em
  andamento/aprovada/descartada), próximo passo.
- **Sem `TAVILY_API_KEY`**: agente avisa que não tem busca na web nem dados
  de mercado em tempo real, nunca finge ter pesquisado.
- **Com `TAVILY_API_KEY`**: ferramenta `search_web` fica disponível, agente
  pesquisa antes de opinar e cita fontes.

### 4.7 Multimodal (foto de recibo)
- Botão de anexar no chat, imagem redimensionada no navegador (canvas, máx.
  1600px, JPEG) antes de enviar.
- Gemini e Anthropic: suportam imagem nativamente (inlineData / image block).
- Groq: modelo padrão não tem visão — em vez de ignorar a imagem, o agente
  é instruído a avisar isso na resposta.
- Agente lê estabelecimento/valor/data do recibo e chama a ferramenta de
  registrar transação sozinho.

### 4.8 Voz bidirecional
- Entrada: `SpeechRecognition` (pt-BR) — botão de microfone no chat.
- Saída: `SpeechSynthesis` (pt-BR) — assistente fala a resposta, com botão
  de mudo (lembrado em localStorage).
- "Orb" animado acima do chat: estados idle/listening/thinking/speaking,
  cada um com cor e velocidade de animação diferentes.
- **Limitação importante**: ambas as APIs exigem contexto seguro (HTTPS ou
  `localhost`) — não funcionam acessando por IP local puro (`http://`).

### 4.9 Visão Geral (dashboard)
- Tela inicial ao abrir o app.
- Gauge circular (SVG, anel de progresso) com % de tarefas concluídas hoje.
- Stat tiles: patrimônio líquido, saldo pessoal, saldo empresa,
  oportunidades ativas.
- Sparkline de evolução do patrimônio, lista da rotina de hoje, últimas
  leituras de saúde.
- Tudo reaproveitando os endpoints dos outros módulos (nenhuma rota nova
  de agregação no backend).

### 4.10 Visual
- Tema escuro com glow sutil (accent color) em botões primários e aba
  ativa, gradiente radial de fundo, título com gradiente de texto.
- Responsivo (mobile-first, já que o uso principal é pelo celular).

---

## 5. Ferramentas do agente (function calling) — lista completa

`create_task`, `list_tasks`, `complete_task`, `remember`, `recall`,
`create_finance_account`, `list_finance_accounts`, `log_transaction`,
`list_transactions`, `get_finance_summary` (todas com parâmetro `scope`
pessoal/empresa), `create_asset`, `list_assets`, `get_net_worth`,
`log_health_metric`, `list_health_metrics`, `get_health_history`,
`create_opportunity`, `list_opportunities`, `update_opportunity`,
`search_web` (só se `TAVILY_API_KEY` configurada).

Todas com **deduplicação defensiva**: alguns modelos (observado com Gemini)
chamam a mesma ferramenta duas vezes na mesma resposta — cada `create_*`
verifica se um registro idêntico foi criado nos últimos 2 minutos antes de
inserir de novo.

---

## 6. Variáveis de ambiente (`.env`)

```
PORT=3001
AI_PROVIDER=gemini              # gemini | groq | anthropic
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash-lite
GROQ_API_KEY=...                # opcional
GROQ_MODEL=llama-3.3-70b-versatile
ANTHROPIC_API_KEY=...           # opcional, pago
ANTHROPIC_MODEL=claude-sonnet-5
TAVILY_API_KEY=...              # opcional, ativa busca na web
ASSISTANT_EMAIL=...
ASSISTANT_PASSWORD=...
USER_NAME=...
JWT_SECRET=...
TIMEZONE=America/Sao_Paulo
```

---

## 7. Bugs reais encontrados durante o desenvolvimento (pra não repetir)

1. **Gemini `thoughtSignature`**: ao reenviar o histórico de tool calling,
   é preciso reenviar as `parts` originais da resposta do modelo (não
   reconstruídas manualmente), porque carregam um campo obrigatório pra
   requisições seguintes funcionarem.
2. **Duplicação de registros**: o modelo às vezes chama a mesma ferramenta
   de criação duas vezes seguidas — todo `create_*`/`log_*` precisa checar
   duplicata recente antes de inserir.
3. **`better-sqlite3` no Windows**: falha de instalação por exigir
   compilação nativa — resolvido trocando pro `node:sqlite` embutido.
4. **`/api/routine/today` só retornava pendentes**: tarefa concluída
   sumia da lista em vez de aparecer riscada — corrigido incluindo também
   as concluídas no próprio dia.
5. **Validação de data no import de CSV**: datas como `30/02/2026` ou
   `2026-13-40` passavam sem erro até adicionar validação de data real
   (não só formato).
6. **Cota do Gemini**: modelo "cheio" (`gemini-3.6-flash`) tem cota
   gratuita diária muito baixa na prática (~20/dia) — usar variante "lite".

---

## 8. Não implementado ainda (próximos passos sugeridos)

- Import automático de extrato direto do banco (Open Finance/Pluggy/Belvo)
  — exige conta de desenvolvedor e plano pago, não avaliado como viável
  ainda para uso pessoal.
- Notificações push no celular.
- Multi-usuário/perfis (hoje é single-user por design).
- Modelo de negócio pra vender a solução (licenciamento, multi-tenancy,
  billing) — usuário mencionou intenção de vender no futuro, mas isso
  ainda não foi desenhado.
- Fallback automático entre provedores de IA quando um bate em limite de
  cota (hoje é troca manual de `AI_PROVIDER` no `.env`).

---

## 9. Código-fonte de referência

O código completo está em:
https://github.com/spartamos365/Ifood-hub (branch `claude/boa-noite-tudo-bem-z7r1i3`)

Se for reconstruir do zero em outra ferramenta, use este documento como
especificação funcional completa — a seção 4 descreve o comportamento
esperado de cada módulo, e a seção 7 evita repetir os mesmos bugs.
