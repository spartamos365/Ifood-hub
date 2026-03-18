// ============================================================
// iFoodHub - Backend Node.js (Express + Microservices)
// Versão: 2.1.0 | Arquitetura: REST API + Webhooks + Polling
// ============================================================

// ─── package.json ────────────────────────────────────────────
/*
{
  "name": "ifoodhub-backend",
  "version": "2.1.0",
  "description": "SaaS de integração iFood para supermercados e restaurantes",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "migrate": "node src/database/migrate.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "winston": "^3.11.0",
    "node-cron": "^3.0.3",
    "socket.io": "^4.6.1",
    "bull": "^4.12.2",
    "uuid": "^9.0.0",
    "express-validator": "^7.0.1",
    "crypto": "^1.0.1"
  }
}
*/

// ─── src/index.js ─────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const logger = require('./utils/logger');
const db = require('./database/connection');
const redis = require('./cache/redis');

// Routes
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const productRoutes = require('./routes/products');
const storeRoutes = require('./routes/stores');
const webhookRoutes = require('./routes/webhooks');
const ifoodRoutes = require('./routes/ifood');
const inventoryRoutes = require('./routes/inventory');
const automationRoutes = require('./routes/automation');
const reportRoutes = require('./routes/reports');

// Services
const IFoodPollingService = require('./services/IFoodPollingService');
const TokenRefreshService = require('./services/TokenRefreshService');
const OrderProcessingService = require('./services/OrderProcessingService');

require('dotenv').config();

const app = express();
const httpServer = createServer(app);

// ─── Socket.IO (Real-time) ────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] }
});

app.set('io', io); // available in routes

io.on('connection', (socket) => {
  logger.info(`Cliente conectado: ${socket.id}`);
  socket.on('join-store', (storeId) => socket.join(`store-${storeId}`));
  socket.on('disconnect', () => logger.info(`Cliente desconectado: ${socket.id}`));
});

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ifood', ifoodRoutes);
app.use('/webhooks', webhookRoutes); // iFood Webhooks (sem /api)

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ─── Cron Jobs ────────────────────────────────────────────────
// Polling a cada 30 segundos (fallback obrigatório iFood)
cron.schedule('*/30 * * * * *', async () => {
  try {
    await IFoodPollingService.pollAllStores();
  } catch (err) {
    logger.error('Polling error:', err.message);
  }
});

// Refresh de tokens OAuth2 a cada 50 minutos
cron.schedule('*/50 * * * *', async () => {
  try {
    await TokenRefreshService.refreshAllTokens();
  } catch (err) {
    logger.error('Token refresh error:', err.message);
  }
});

// Limpeza de logs antigos (diário)
cron.schedule('0 2 * * *', async () => {
  await db.query(`DELETE FROM api_logs WHERE created_at < NOW() - INTERVAL '30 days'`);
  logger.info('Logs antigos removidos');
});

// ─── Server Start ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  logger.info(`🚀 iFoodHub Backend rodando na porta ${PORT}`);
  logger.info(`📡 Polling iFood ativo (30s intervalo)`);
  logger.info(`🔌 Socket.IO pronto para conexões em tempo real`);
});

module.exports = { app, io };


// ─────────────────────────────────────────────────────────────
// src/services/IFoodService.js
// CORE: Integração com a Merchant API do iFood
// ─────────────────────────────────────────────────────────────
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const IFOOD_BASE_URL = process.env.IFOOD_ENV === 'sandbox'
  ? 'https://merchant-api.ifood.com.br/sandbox'
  : 'https://merchant-api.ifood.com.br';

class IFoodService {
  constructor(store) {
    this.store = store;
    this.client = axios.create({
      baseURL: IFOOD_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${store.access_token}`,
      }
    });

    // Interceptor para log de chamadas
    this.client.interceptors.response.use(
      res => { this._logCall(res.config, 200, 'success'); return res; },
      async err => {
        this._logCall(err.config, err.response?.status, 'error');
        if (err.response?.status === 401) {
          await this._refreshToken();
          return this.client.request(err.config);
        }
        throw err;
      }
    );
  }

  // ── OAuth2 ────────────────────────────────────────────────
  static async getAccessToken(clientId, clientSecret) {
    const params = new URLSearchParams({
      grantType: 'client_credentials',
      clientId,
      clientSecret,
    });

    const res = await axios.post(
      `${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return {
      access_token: res.data.accessToken,
      refresh_token: res.data.refreshToken,
      expires_in: res.data.expiresIn,
      token_type: res.data.tokenType,
    };
  }

  async _refreshToken() {
    const params = new URLSearchParams({
      grantType: 'refresh_token',
      clientId: this.store.ifood_client_id,
      refreshToken: this.store.refresh_token,
    });

    const res = await axios.post(
      `${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Persiste novo token no banco
    await db.query(
      `UPDATE stores SET access_token=$1, refresh_token=$2, token_expires_at=$3 WHERE id=$4`,
      [res.data.accessToken, res.data.refreshToken, new Date(Date.now() + res.data.expiresIn * 1000), this.store.id]
    );

    this.client.defaults.headers['Authorization'] = `Bearer ${res.data.accessToken}`;
    logger.info(`Token renovado para loja: ${this.store.name}`);
  }

  // ── Pedidos ───────────────────────────────────────────────
  async getOrders(statuses = ['PLACED', 'CONFIRMED']) {
    const res = await this.client.get('/order/v1.0/events:polling', {
      params: { groups: statuses.join(',') }
    });
    return res.data;
  }

  async acknowledgeEvents(eventIds) {
    await this.client.post('/order/v1.0/events/acknowledgment', { eventIds });
  }

  async confirmOrder(orderId) {
    return this.client.post(`/order/v1.0/orders/${orderId}/statuses/confirmed`);
  }

  async startPreparation(orderId) {
    return this.client.post(`/order/v1.0/orders/${orderId}/statuses/preparation-started`);
  }

  async readyToPickup(orderId) {
    return this.client.post(`/order/v1.0/orders/${orderId}/statuses/ready-to-pickup`);
  }

  async dispatchOrder(orderId) {
    return this.client.post(`/order/v1.0/orders/${orderId}/statuses/dispatch`);
  }

  async cancelOrder(orderId, reason = 'ORDER_CANCELLED_BY_MERCHANT') {
    return this.client.post(`/order/v1.0/orders/${orderId}/statuses/cancellationRequested`, {
      reason, cancellationCode: '501',
    });
  }

  async getOrderDetails(orderId) {
    const res = await this.client.get(`/order/v1.0/orders/${orderId}`);
    return res.data;
  }

  // ── Catálogo ──────────────────────────────────────────────
  async getCatalog() {
    const res = await this.client.get(`/catalog/v2.0/merchants/${this.store.ifood_merchant_id}/catalog`);
    return res.data;
  }

  async updateProductPrice(itemId, price) {
    return this.client.patch(
      `/catalog/v2.0/merchants/${this.store.ifood_merchant_id}/items/${itemId}/price`,
      { price }
    );
  }

  async updateProductStock(itemId, quantity) {
    return this.client.patch(
      `/catalog/v2.0/merchants/${this.store.ifood_merchant_id}/items/${itemId}`,
      { status: quantity > 0 ? 'AVAILABLE' : 'UNAVAILABLE' }
    );
  }

  async createProduct(product) {
    return this.client.post(
      `/catalog/v2.0/merchants/${this.store.ifood_merchant_id}/items`,
      {
        externalCode: product.sku,
        name: product.name,
        description: product.description,
        price: { value: product.price, originalValue: product.price },
        unit: { type: 'UNIT', quantity: 1 },
        status: product.stock > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
      }
    );
  }

  async publishCatalog() {
    return this.client.post(
      `/catalog/v2.0/merchants/${this.store.ifood_merchant_id}/catalog/publication`
    );
  }

  // ── Loja ─────────────────────────────────────────────────
  async openStore() {
    return this.client.post(
      `/merchant/v1.0/merchants/${this.store.ifood_merchant_id}/status`,
      { operation: 'OPEN' }
    );
  }

  async pauseStore(duration = 30) {
    return this.client.post(
      `/merchant/v1.0/merchants/${this.store.ifood_merchant_id}/status`,
      { operation: 'PAUSED', duration }
    );
  }

  async getMerchantStatus() {
    const res = await this.client.get(
      `/merchant/v1.0/merchants/${this.store.ifood_merchant_id}/status`
    );
    return res.data;
  }

  // ── Helpers ───────────────────────────────────────────────
  async _logCall(config, statusCode, status) {
    try {
      await db.query(
        `INSERT INTO api_logs (store_id, method, endpoint, status_code, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [this.store.id, config?.method?.toUpperCase(), config?.url, statusCode, status]
      );
    } catch {}
  }
}

module.exports = IFoodService;


// ─────────────────────────────────────────────────────────────
// src/services/IFoodPollingService.js
// Polling de 30s obrigatório como fallback
// ─────────────────────────────────────────────────────────────
const IFoodService = require('./IFoodService');
const OrderProcessingService = require('./OrderProcessingService');

class IFoodPollingService {
  static async pollAllStores() {
    const stores = await db.query(
      `SELECT * FROM stores WHERE is_active = true AND ifood_connected = true`
    );

    for (const store of stores.rows) {
      try {
        await this.pollStore(store);
      } catch (err) {
        logger.error(`Polling falhou para loja ${store.name}:`, err.message);
      }
    }
  }

  static async pollStore(store) {
    const service = new IFoodService(store);
    const events = await service.getOrders();

    if (!events || events.length === 0) return;

    logger.info(`[POLLING] Loja ${store.name}: ${events.length} eventos`);

    const eventIds = [];
    for (const event of events) {
      try {
        await OrderProcessingService.processEvent(event, store);
        eventIds.push(event.id);
      } catch (err) {
        logger.error(`Erro processando evento ${event.id}:`, err.message);
      }
    }

    // Acknowledge os eventos processados
    if (eventIds.length > 0) {
      await service.acknowledgeEvents(eventIds);
    }
  }
}

module.exports = IFoodPollingService;


// ─────────────────────────────────────────────────────────────
// src/services/OrderProcessingService.js
// Processamento idempotente de pedidos
// ─────────────────────────────────────────────────────────────
class OrderProcessingService {
  static async processEvent(event, store) {
    const { code, orderId, fullCode } = event;

    // Idempotência: evita duplicatas
    const exists = await db.query(
      `SELECT id FROM order_events WHERE ifood_event_id = $1`,
      [event.id]
    );
    if (exists.rows.length > 0) return;

    // Persiste o evento
    await db.query(
      `INSERT INTO order_events (ifood_event_id, order_id, event_code, store_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [event.id, orderId, code, store.id]
    );

    switch (code) {
      case 'PLACED':
        await this.handleNewOrder(orderId, store);
        break;
      case 'CONFIRMED':
        await this.updateOrderStatus(orderId, 'confirmed', store);
        break;
      case 'CANCELLATION_REQUESTED':
        await this.handleCancellation(orderId, store);
        break;
      case 'CONCLUDED':
        await this.updateOrderStatus(orderId, 'delivered', store);
        await this.deductInventory(orderId, store);
        break;
    }
  }

  static async handleNewOrder(orderId, store) {
    const service = new IFoodService(store);
    const orderDetails = await service.getOrderDetails(orderId);

    // Salva pedido no banco
    const result = await db.query(
      `INSERT INTO orders (
        ifood_order_id, store_id, customer_name, customer_phone,
        total_amount, status, delivery_address, items, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      ON CONFLICT (ifood_order_id) DO NOTHING RETURNING id`,
      [
        orderId, store.id,
        orderDetails.customer.name,
        orderDetails.customer.phone,
        orderDetails.totalPrice,
        'pending',
        JSON.stringify(orderDetails.deliveryAddress),
        JSON.stringify(orderDetails.items),
      ]
    );

    if (!result.rows.length) return; // duplicata ignorada

    // Emite via Socket.IO para dashboard em tempo real
    const io = require('../index').io;
    io.to(`store-${store.id}`).emit('new-order', {
      orderId,
      customer: orderDetails.customer.name,
      total: orderDetails.totalPrice,
      storeId: store.id,
    });

    logger.info(`✅ Novo pedido: ${orderId} | Loja: ${store.name}`);

    // Verifica regras de automação
    await AutomationService.evaluateOrderRules(orderId, orderDetails, store);
  }

  static async updateOrderStatus(orderId, status, store) {
    await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE ifood_order_id = $2`,
      [status, orderId]
    );
    const io = require('../index').io;
    io.to(`store-${store.id}`).emit('order-status-updated', { orderId, status });
  }

  static async deductInventory(orderId, store) {
    const order = await db.query(
      `SELECT items FROM orders WHERE ifood_order_id = $1`,
      [orderId]
    );
    if (!order.rows.length) return;

    const items = order.rows[0].items;
    for (const item of items) {
      await db.query(
        `UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE sku = $2 AND store_id = $3`,
        [item.quantity, item.externalCode, store.id]
      );

      // Verifica se zerou
      const prod = await db.query(
        `SELECT stock, name FROM products WHERE sku = $1 AND store_id = $2`,
        [item.externalCode, store.id]
      );

      if (prod.rows[0]?.stock === 0) {
        logger.warn(`⚠ Estoque zerado: ${prod.rows[0].name} | Loja ${store.name}`);
        await AutomationService.evaluateStockRules(prod.rows[0], store);
      }
    }
  }

  static async handleCancellation(orderId, store) {
    await this.updateOrderStatus(orderId, 'cancelled', store);
    logger.info(`❌ Pedido cancelado: ${orderId}`);
  }
}

module.exports = OrderProcessingService;


// ─────────────────────────────────────────────────────────────
// src/services/AutomationService.js
// Regras de automação inteligente
// ─────────────────────────────────────────────────────────────
const IFoodService = require('./IFoodService');
const NotificationService = require('./NotificationService');

class AutomationService {
  static async evaluateOrderRules(orderId, orderDetails, store) {
    const rules = await db.query(
      `SELECT * FROM automation_rules WHERE store_id = $1 AND type = 'ORDER' AND is_active = true`,
      [store.id]
    );

    for (const rule of rules.rows) {
      const config = rule.config;

      if (rule.name === 'auto_confirm' && orderDetails.totalPrice <= (config.max_value || 150)) {
        const service = new IFoodService(store);
        await service.confirmOrder(orderId);
        logger.info(`🤖 Auto-confirmado: ${orderId}`);
      }
    }

    // Notificação WhatsApp
    await NotificationService.sendOrderAlert(store, orderDetails);
  }

  static async evaluateStockRules(product, store) {
    const rules = await db.query(
      `SELECT * FROM automation_rules WHERE store_id = $1 AND type = 'STOCK' AND is_active = true`,
      [store.id]
    );

    for (const rule of rules.rows) {
      if (rule.name === 'pause_on_empty') {
        const service = new IFoodService(store);
        await service.pauseStore(30);
        logger.warn(`⏸ Loja pausada automaticamente: ${store.name}`);

        const io = require('../index').io;
        io.to(`store-${store.id}`).emit('store-paused', {
          storeId: store.id,
          reason: `Estoque zerado: ${product.name}`,
        });
      }
    }
  }
}

module.exports = AutomationService;


// ─────────────────────────────────────────────────────────────
// src/routes/webhooks.js
// Listener de Webhooks do iFood
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const OrderProcessingService = require('../services/OrderProcessingService');

// Valida assinatura HMAC do iFood
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-ifood-signature'];
  const secret = process.env.IFOOD_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== `sha256=${expected}`) {
    logger.warn('Webhook com assinatura inválida rejeitado');
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  next();
}

router.post('/ifood/events', verifyWebhookSignature, async (req, res) => {
  // Responde 200 imediatamente (iFood exige resposta rápida)
  res.status(200).json({ received: true });

  const events = Array.isArray(req.body) ? req.body : [req.body];
  logger.info(`[WEBHOOK] ${events.length} evento(s) recebido(s)`);

  for (const event of events) {
    try {
      const store = await db.query(
        `SELECT * FROM stores WHERE ifood_merchant_id = $1`,
        [event.merchantId]
      );

      if (!store.rows.length) continue;

      await OrderProcessingService.processEvent(event, store.rows[0]);
    } catch (err) {
      logger.error('Webhook processing error:', err.message);
    }
  }
});

module.exports = router;


// ─────────────────────────────────────────────────────────────
// src/routes/orders.js
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const IFoodService = require('../services/IFoodService');

router.use(authMiddleware);

// Listar pedidos
router.get('/', async (req, res) => {
  const { storeId, status, limit = 50, offset = 0 } = req.query;

  let query = `SELECT o.*, s.name as store_name FROM orders o
               JOIN stores s ON o.store_id = s.id
               WHERE s.tenant_id = $1`;
  const params = [req.user.tenantId];

  if (storeId) { query += ` AND o.store_id = $${params.length + 1}`; params.push(storeId); }
  if (status)  { query += ` AND o.status = $${params.length + 1}`;   params.push(status); }

  query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  res.json({ orders: result.rows, total: result.rows.length });
});

// Atualizar status manualmente
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, storeId } = req.body;

  const store = await db.query(`SELECT * FROM stores WHERE id = $1 AND tenant_id = $2`, [storeId, req.user.tenantId]);
  if (!store.rows.length) return res.status(403).json({ error: 'Sem permissão' });

  const service = new IFoodService(store.rows[0]);

  const order = await db.query(`SELECT ifood_order_id FROM orders WHERE id = $1`, [id]);
  const ifoodOrderId = order.rows[0]?.ifood_order_id;

  const statusMap = {
    confirmed:  () => service.confirmOrder(ifoodOrderId),
    preparing:  () => service.startPreparation(ifoodOrderId),
    delivering: () => service.dispatchOrder(ifoodOrderId),
    delivered:  () => service.readyToPickup(ifoodOrderId),
  };

  if (statusMap[status]) await statusMap[status]();

  await db.query(`UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);

  const io = req.app.get('io');
  io.to(`store-${storeId}`).emit('order-status-updated', { orderId: id, status });

  res.json({ success: true, status });
});

module.exports = router;


// ─────────────────────────────────────────────────────────────
// src/routes/products.js
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const IFoodService = require('../services/IFoodService');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { storeId } = req.query;
  const result = await db.query(
    `SELECT * FROM products WHERE store_id = $1 ORDER BY name`,
    [storeId]
  );
  res.json({ products: result.rows });
});

router.post('/', async (req, res) => {
  const { storeId, name, sku, price, stock, category, description } = req.body;

  const result = await db.query(
    `INSERT INTO products (store_id, name, sku, price, stock, category, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [storeId, name, sku, price, stock, category, description]
  );

  res.status(201).json({ product: result.rows[0] });
});

// Sincronizar produto com iFood
router.post('/:id/sync', async (req, res) => {
  const { id } = req.params;
  const { storeId } = req.body;

  const store = await db.query(`SELECT * FROM stores WHERE id = $1`, [storeId]);
  const product = await db.query(`SELECT * FROM products WHERE id = $1`, [id]);

  if (!store.rows.length || !product.rows.length) {
    return res.status(404).json({ error: 'Recurso não encontrado' });
  }

  const service = new IFoodService(store.rows[0]);
  const p = product.rows[0];

  let ifoodId = p.ifood_item_id;

  try {
    if (ifoodId) {
      // Atualiza produto existente
      await service.updateProductPrice(ifoodId, p.price);
      await service.updateProductStock(ifoodId, p.stock);
    } else {
      // Cria novo produto
      const created = await service.createProduct(p);
      ifoodId = created.data.id;
      await db.query(`UPDATE products SET ifood_item_id = $1, synced_at = NOW() WHERE id = $2`, [ifoodId, id]);
    }

    await service.publishCatalog();
    res.json({ success: true, ifoodId });
  } catch (err) {
    logger.error('Sync error:', err.message);
    res.status(500).json({ error: 'Falha na sincronização', details: err.message });
  }
});

// Atualizar preço em lote
router.patch('/bulk-price', async (req, res) => {
  const { updates, storeId } = req.body; // [{ sku, price }]

  const store = await db.query(`SELECT * FROM stores WHERE id = $1`, [storeId]);
  const service = new IFoodService(store.rows[0]);

  const results = [];
  for (const update of updates) {
    try {
      await db.query(`UPDATE products SET price = $1 WHERE sku = $2 AND store_id = $3`, [update.price, update.sku, storeId]);

      const prod = await db.query(`SELECT ifood_item_id FROM products WHERE sku = $1`, [update.sku]);
      if (prod.rows[0]?.ifood_item_id) {
        await service.updateProductPrice(prod.rows[0].ifood_item_id, update.price);
      }
      results.push({ sku: update.sku, status: 'updated' });
    } catch (err) {
      results.push({ sku: update.sku, status: 'error', error: err.message });
    }
  }

  await service.publishCatalog();
  res.json({ results });
});

module.exports = router;


// ─────────────────────────────────────────────────────────────
// src/middleware/auth.js — JWT + Multi-tenant
// ─────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token ausente' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};


// ─────────────────────────────────────────────────────────────
// src/routes/auth.js
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const IFoodService = require('../services/IFoodService');

router.post('/register', async (req, res) => {
  const { name, email, password, plan = 'starter' } = req.body;

  const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows.length) return res.status(400).json({ error: 'E-mail já cadastrado' });

  const hashedPassword = await bcrypt.hash(password, 12);

  const tenant = await db.query(
    `INSERT INTO tenants (name, plan, created_at) VALUES ($1, $2, NOW()) RETURNING id`,
    [name, plan]
  );

  const user = await db.query(
    `INSERT INTO users (tenant_id, name, email, password, role) VALUES ($1,$2,$3,$4,'owner') RETURNING id, name, email`,
    [tenant.rows[0].id, name, email, hashedPassword]
  );

  const token = jwt.sign(
    { userId: user.rows[0].id, tenantId: tenant.rows[0].id, role: 'owner' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({ user: user.rows[0], token });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await db.query(`SELECT * FROM users WHERE email = $1`, [email]);
  if (!user.rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.rows[0].password);
  if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

  const token = jwt.sign(
    { userId: user.rows[0].id, tenantId: user.rows[0].tenant_id, role: user.rows[0].role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.rows[0].id, name: user.rows[0].name, email: user.rows[0].email } });
});

// Conectar loja ao iFood via OAuth2
router.post('/ifood/connect', async (req, res) => {
  const { clientId, clientSecret, merchantId, storeId } = req.body;

  try {
    const tokens = await IFoodService.getAccessToken(clientId, clientSecret);

    await db.query(
      `UPDATE stores SET
        ifood_client_id = $1, ifood_client_secret = $2, ifood_merchant_id = $3,
        access_token = $4, refresh_token = $5,
        token_expires_at = $6, ifood_connected = true
       WHERE id = $7`,
      [clientId, clientSecret, merchantId, tokens.access_token,
       tokens.refresh_token, new Date(Date.now() + tokens.expires_in * 1000), storeId]
    );

    res.json({ success: true, message: 'Loja conectada ao iFood com sucesso!' });
  } catch (err) {
    res.status(400).json({ error: 'Falha na autenticação iFood', details: err.message });
  }
});

module.exports = router;


// ─────────────────────────────────────────────────────────────
// src/utils/logger.js
// ─────────────────────────────────────────────────────────────
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) =>
      `[${timestamp}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

module.exports = logger;
