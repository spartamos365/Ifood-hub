const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let orders = [
  { id: 'ORD-001', customer: 'Carlos Mendes', items: ['Cerveja Skol x6', 'Salgadinho'], total: 48.90, status: 'preparing', time: '14:32', store: 'Loja Principal' },
  { id: 'ORD-002', customer: 'Ana Lima', items: ['Leite Integral x2', 'Pao de Forma'], total: 22.50, status: 'confirmed', time: '14:28', store: 'Loja Principal' },
  { id: 'ORD-003', customer: 'Rafael Costa', items: ['Frango 2kg', 'Arroz 5kg'], total: 89.70, status: 'delivering', time: '14:15', store: 'Loja Principal' },
  { id: 'ORD-004', customer: 'Mariana Souza', items: ['Coca-Cola 2L x3'], total: 36.20, status: 'delivered', time: '13:58', store: 'Loja Principal' },
];

let products = [
  { id: 'P001', name: 'Cerveja Skol 350ml', sku: 'CRV-SKL-350', price: 4.99, stock: 240, category: 'Bebidas', synced: true },
  { id: 'P002', name: 'Coca-Cola 2L', sku: 'COC-2L', price: 9.50, stock: 85, category: 'Bebidas', synced: true },
  { id: 'P003', name: 'Arroz Tio Joao 5kg', sku: 'ARR-TJ-5K', price: 28.90, stock: 12, category: 'Graos', synced: true },
  { id: 'P004', name: 'Feijao Carioca 1kg', sku: 'FEJ-CAR-1K', price: 8.50, stock: 0, category: 'Graos', synced: false },
  { id: 'P005', name: 'Leite Integral 1L', sku: 'LTE-INT-1L', price: 5.20, stock: 156, category: 'Laticinios', synced: true },
];

let stores = [
  { id: 'S1', name: 'Loja Principal', status: 'open', ordersToday: 47, revenue: 2840.50, ifoodConnected: false },
];

app.get('/health', (req, res) => {
  res.json({ status: 'ok', system: 'iFoodHub', version: '2.1.0', uptime: process.uptime() });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@ifoodhub.com' && password === 'Admin@2024') {
    res.json({ token: 'ifoodhub-demo-token-2024', user: { id: '1', name: 'Administrador', email, role: 'owner' } });
  } else {
    res.status(401).json({ error: 'Email ou senha incorretos' });
  }
});

app.get('/api/orders', (req, res) => {
  const { status } = req.query;
  const filtered = status ? orders.filter(o => o.status === status) : orders;
  res.json({ orders: filtered, total: filtered.length });
});

app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Pedido nao encontrado' });
  order.status = status;
  res.json({ success: true, order });
});

app.get('/api/products', (req, res) => {
  res.json({ products, total: products.length });
});

app.post('/api/products', (req, res) => {
  const product = { id: 'P' + Date.now(), synced: false, ...req.body };
  products.push(product);
  res.status(201).json({ product });
});

app.post('/api/products/:id/sync', (req, res) => {
  const { id } = req.params;
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ error: 'Produto nao encontrado' });
  product.synced = true;
  product.ifoodId = 'IFD-' + Math.floor(Math.random() * 9000 + 1000);
  res.json({ success: true, ifoodId: product.ifoodId });
});

app.get('/api/stores', (req, res) => res.json({ stores }));

app.post('/api/auth/ifood/connect', (req, res) => {
  const { storeId } = req.body;
  const store = stores.find(s => s.id === storeId);
  if (store) store.ifoodConnected = true;
  res.json({ success: true, message: 'Loja conectada ao iFood com sucesso!' });
});

app.post('/webhooks/ifood/events', (req, res) => {
  res.status(200).json({ received: true });
});

app.get('/api/reports/summary', (req, res) => {
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  res.json({
    ordersToday: orders.length,
    revenue: revenue.toFixed(2),
    avgTicket: (revenue / orders.length).toFixed(2),
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    activeOrders: orders.filter(o => ['confirmed','preparing','delivering'].includes(o.status)).length,
  });
});

app.get('/api/automation', (req, res) => {
  res.json({ rules: [
    { id: 1, name: 'Auto-confirmar pedidos', type: 'ORDER', enabled: false },
    { id: 2, name: 'Pausar loja com estoque zero', type: 'STOCK', enabled: false },
    { id: 3, name: 'Alerta WhatsApp pedido novo', type: 'NOTIFY', enabled: false },
    { id: 4, name: 'Retry automatico de falhas', type: 'API', enabled: true },
  ]});
});

app.get('/', (req, res) => {
  res.send('<html><body style="background:#0a0c12;color:#fff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#ea1d2c;font-size:3rem">iFood<span style="color:#fff">Hub</span></h1><p>API v2.1.0 — ONLINE</p><p><a href="/health" style="color:#ea1d2c">/health</a></p></div></body></html>');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log('iFoodHub na porta ' + PORT));
