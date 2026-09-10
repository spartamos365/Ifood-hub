require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');

const { ensureOwnerUser, login, requireAuth } = require('./auth');
const db = require('./db');
const chatRoutes = require('./routes/chat');
const routineRoutes = require('./routes/routine');
const createFinanceRouter = require('./routes/finance');
const patrimonioRoutes = require('./routes/patrimonio');
const healthRoutes = require('./routes/health');
const opportunitiesRoutes = require('./routes/opportunities');
const { startScheduler, generateBriefing } = require('./scheduler');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [new winston.transports.Console()],
});

const aiProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const providerKeyVars = { anthropic: 'ANTHROPIC_API_KEY', groq: 'GROQ_API_KEY', gemini: 'GEMINI_API_KEY' };
const providerKeyVar = providerKeyVars[aiProvider] || 'GEMINI_API_KEY';

const requiredEnv = [providerKeyVar, 'ASSISTANT_EMAIL', 'ASSISTANT_PASSWORD', 'JWT_SECRET'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Faltam variáveis no .env: ${missing.join(', ')}. Copie .env.example para .env e preencha.`);
  process.exit(1);
}

const ownerUserId = ensureOwnerUser();

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' })); // extratos CSV podem ser maiores que o default de 100kb
app.use((req, res, next) => { req.log = logger; next(); });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', system: 'Assistente Pessoal', uptime: process.uptime() });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const result = login(email, password);
  if (!result) return res.status(401).json({ error: 'Email ou senha incorretos' });
  res.json(result);
});

app.use('/api/chat', requireAuth, chatRoutes);
app.use('/api/routine', requireAuth, routineRoutes);
app.use('/api/finance', requireAuth, createFinanceRouter('pessoal'));
app.use('/api/company/finance', requireAuth, createFinanceRouter('empresa'));
app.use('/api/patrimonio', requireAuth, patrimonioRoutes);
app.use('/api/health', requireAuth, healthRoutes);
app.use('/api/opportunities', requireAuth, opportunitiesRoutes);

app.post('/api/routine/briefing/generate', requireAuth, async (req, res) => {
  try {
    await generateBriefing(req.userId);
    const todayStr = new Date().toISOString().slice(0, 10);
    const row = db.prepare('SELECT * FROM briefings WHERE user_id = ? AND date = ?').get(req.userId, todayStr);
    res.json({ briefing: row });
  } catch (err) {
    logger.error('Erro ao gerar briefing: ' + err.message);
    res.status(500).json({ error: 'Falha ao gerar o resumo matinal' });
  }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

startScheduler(() => ownerUserId);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Assistente pessoal rodando em http://0.0.0.0:${PORT}`);
});
