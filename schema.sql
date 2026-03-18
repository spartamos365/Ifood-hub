-- ============================================================
-- iFoodHub — Schema PostgreSQL Completo
-- Multi-tenant | Escalável | Otimizado para alta disponibilidade
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- busca por texto

-- ─── Tenants (Multi-tenant) ───────────────────────────────────
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  plan          VARCHAR(50) NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  is_active     BOOLEAN NOT NULL DEFAULT true,
  max_stores    INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'operator', -- owner | manager | operator
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ─── Stores (Lojas) ──────────────────────────────────────────
CREATE TABLE stores (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  VARCHAR(255) NOT NULL,
  document              VARCHAR(20),  -- CNPJ
  phone                 VARCHAR(20),
  address               JSONB,

  -- iFood OAuth2
  ifood_merchant_id     VARCHAR(255) UNIQUE,
  ifood_client_id       VARCHAR(255),
  ifood_client_secret   TEXT,         -- criptografado
  access_token          TEXT,         -- criptografado
  refresh_token         TEXT,         -- criptografado
  token_expires_at      TIMESTAMPTZ,
  ifood_connected       BOOLEAN NOT NULL DEFAULT false,

  -- Status
  status                VARCHAR(50) NOT NULL DEFAULT 'open', -- open | paused | closed
  is_active             BOOLEAN NOT NULL DEFAULT true,

  -- WhatsApp
  whatsapp_number       VARCHAR(20),
  whatsapp_token        TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_tenant ON stores(tenant_id);
CREATE INDEX idx_stores_merchant ON stores(ifood_merchant_id);

-- ─── Categories ──────────────────────────────────────────────
CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  ifood_cat_id  VARCHAR(255),
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

-- ─── Products (Catálogo) ──────────────────────────────────────
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id),

  name            VARCHAR(255) NOT NULL,
  sku             VARCHAR(100) NOT NULL,
  description     TEXT,
  image_url       TEXT,

  -- Preço
  price           NUMERIC(10,2) NOT NULL,
  original_price  NUMERIC(10,2),

  -- Estoque
  stock           INT NOT NULL DEFAULT 0,
  min_stock       INT NOT NULL DEFAULT 5,  -- alerta quando abaixo
  unit_type       VARCHAR(50) DEFAULT 'UNIT',

  -- iFood
  ifood_item_id   VARCHAR(255),
  ifood_status    VARCHAR(50) DEFAULT 'UNAVAILABLE',
  synced_at       TIMESTAMPTZ,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(store_id, sku)
);

CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_sku ON products(store_id, sku);
CREATE INDEX idx_products_ifood ON products(ifood_item_id);
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- ─── Orders (Pedidos) ─────────────────────────────────────────
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          UUID NOT NULL REFERENCES stores(id),
  ifood_order_id    VARCHAR(255) UNIQUE,  -- idempotência

  -- Cliente
  customer_name     VARCHAR(255),
  customer_phone    VARCHAR(20),
  customer_document VARCHAR(20),

  -- Valores
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(10,2) NOT NULL,

  -- Status
  status            VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending | confirmed | preparing | ready | delivering | delivered | cancelled

  -- Endereço e dados iFood
  delivery_address  JSONB,
  items             JSONB NOT NULL DEFAULT '[]',
  payment_method    VARCHAR(100),
  origin            VARCHAR(50) DEFAULT 'IFOOD', -- IFOOD | WHATSAPP | LOCAL

  -- Timestamps
  confirmed_at      TIMESTAMPTZ,
  preparing_at      TIMESTAMPTZ,
  delivering_at     TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_ifood ON orders(ifood_order_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ─── Order Events (Idempotência & Auditoria) ──────────────────
CREATE TABLE order_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ifood_event_id  VARCHAR(255) UNIQUE NOT NULL,
  order_id        VARCHAR(255),
  store_id        UUID REFERENCES stores(id),
  event_code      VARCHAR(100) NOT NULL,
  raw_payload     JSONB,
  processed       BOOLEAN NOT NULL DEFAULT false,
  source          VARCHAR(50) DEFAULT 'POLLING', -- POLLING | WEBHOOK
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_ifood ON order_events(ifood_event_id);
CREATE INDEX idx_events_order ON order_events(order_id);

-- ─── Inventory Movements (Movimentações) ─────────────────────
CREATE TABLE inventory_movements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id),
  product_id  UUID NOT NULL REFERENCES products(id),
  order_id    UUID REFERENCES orders(id),
  type        VARCHAR(50) NOT NULL, -- SALE | ADJUSTMENT | RETURN | IMPORT
  quantity    INT NOT NULL,         -- positivo = entrada, negativo = saída
  stock_after INT NOT NULL,
  note        TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_product ON inventory_movements(product_id);
CREATE INDEX idx_inv_store ON inventory_movements(store_id);

-- ─── Automation Rules ─────────────────────────────────────────
CREATE TABLE automation_rules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(50) NOT NULL, -- ORDER | STOCK | PRICE | NOTIFY | API
  description TEXT,
  config      JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── API Logs ─────────────────────────────────────────────────
CREATE TABLE api_logs (
  id          BIGSERIAL PRIMARY KEY,
  store_id    UUID REFERENCES stores(id),
  method      VARCHAR(10),
  endpoint    TEXT,
  status_code INT,
  status      VARCHAR(50),  -- success | error | info
  duration_ms INT,
  request_id  VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Partições mensais para alta performance
CREATE TABLE api_logs_2025_01 PARTITION OF api_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE api_logs_2025_02 PARTITION OF api_logs
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- (Criar novas partições mensalmente via cron)

CREATE INDEX idx_logs_store ON api_logs(store_id, created_at DESC);
CREATE INDEX idx_logs_status ON api_logs(status, created_at DESC);

-- ─── Notifications ────────────────────────────────────────────
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id),
  type        VARCHAR(50) NOT NULL, -- ORDER | STOCK | SYSTEM | ALERT
  title       VARCHAR(255) NOT NULL,
  message     TEXT,
  channel     VARCHAR(50) DEFAULT 'DASHBOARD', -- DASHBOARD | WHATSAPP | EMAIL
  is_read     BOOLEAN NOT NULL DEFAULT false,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_store ON notifications(store_id, is_read, created_at DESC);

-- ─── Financial (Financeiro) ───────────────────────────────────
CREATE TABLE financial_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES stores(id),
  order_id        UUID REFERENCES orders(id),
  type            VARCHAR(50) NOT NULL, -- REVENUE | FEE | REFUND
  amount          NUMERIC(10,2) NOT NULL,
  ifood_fee       NUMERIC(10,2) DEFAULT 0,
  net_amount      NUMERIC(10,2),
  payment_method  VARCHAR(100),
  reference_date  DATE NOT NULL,
  status          VARCHAR(50) DEFAULT 'PENDING', -- PENDING | SETTLED | CANCELLED
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_store ON financial_transactions(store_id, reference_date DESC);

-- ─── Refresh Tokens ───────────────────────────────────────────
CREATE TABLE user_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id),
  refresh_token VARCHAR(500) NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Default automation rules (INSERT no setup) ───────────────
CREATE OR REPLACE FUNCTION setup_default_automation_rules(p_store_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO automation_rules (store_id, name, type, description, config, is_active) VALUES
    (p_store_id, 'auto_confirm', 'ORDER', 'Auto-confirmar pedidos abaixo de R$150',
     '{"max_value": 150}', false),
    (p_store_id, 'pause_on_empty', 'STOCK', 'Pausar loja com produto crítico zerado',
     '{"pause_duration": 30}', false),
    (p_store_id, 'whatsapp_new_order', 'NOTIFY', 'Notificação WhatsApp pedido novo',
     '{"template": "new_order"}', false),
    (p_store_id, 'api_retry', 'API', 'Retry automático em falhas de API',
     '{"max_retries": 3, "backoff_seconds": 5}', true);
END;
$$ LANGUAGE plpgsql;

-- ─── Views úteis ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_store_dashboard AS
SELECT
  s.id AS store_id,
  s.name AS store_name,
  s.status AS store_status,
  COUNT(DISTINCT o.id) FILTER (WHERE o.created_at >= CURRENT_DATE) AS orders_today,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('pending','confirmed','preparing','delivering')) AS active_orders,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.status != 'cancelled'), 0) AS revenue_today,
  COALESCE(AVG(o.total_amount) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.status != 'cancelled'), 0) AS avg_ticket,
  COUNT(DISTINCT p.id) FILTER (WHERE p.stock = 0) AS out_of_stock_count
FROM stores s
LEFT JOIN orders o ON o.store_id = s.id
LEFT JOIN products p ON p.store_id = s.id
WHERE s.is_active = true
GROUP BY s.id, s.name, s.status;

-- ─── Triggers ────────────────────────────────────────────────
-- Auto-atualiza updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated     BEFORE UPDATE ON orders     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated   BEFORE UPDATE ON products   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_stores_updated     BEFORE UPDATE ON stores     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Registra movimentação de estoque automaticamente
CREATE OR REPLACE FUNCTION register_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stock != NEW.stock THEN
    INSERT INTO inventory_movements (store_id, product_id, type, quantity, stock_after)
    VALUES (NEW.store_id, NEW.id, 'ADJUSTMENT', NEW.stock - OLD.stock, NEW.stock);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_stock_change
  AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION register_inventory_movement();
