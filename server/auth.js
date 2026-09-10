const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '30d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET nao definido no .env — veja .env.example');
}

// Garante que existe exatamente um usuário (uso pessoal, single-user),
// criado a partir de ASSISTANT_EMAIL / ASSISTANT_PASSWORD do .env.
function ensureOwnerUser() {
  const email = process.env.ASSISTANT_EMAIL;
  const password = process.env.ASSISTANT_PASSWORD;
  const name = process.env.USER_NAME || 'Você';

  if (!email || !password) {
    throw new Error('ASSISTANT_EMAIL e ASSISTANT_PASSWORD precisam estar definidos no .env');
  }

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    // Se a senha no .env mudou, atualiza o hash para refletir a nova senha.
    if (!bcrypt.compareSync(password, existing.password_hash)) {
      const password_hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password_hash = ?, name = ? WHERE id = ?')
        .run(password_hash, name, existing.id);
    }
    return existing.id;
  }

  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
    .run(id, email, password_hash, name);
  return id;
}

function login(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;

  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Nao autenticado' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
}

module.exports = { ensureOwnerUser, login, requireAuth };
