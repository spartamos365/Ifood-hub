import { useState, useEffect, useRef } from "react";

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_ORDERS = [
  { id: "ORD-8821", customer: "Carlos Mendes", items: ["Cerveja Skol 350ml x6", "Salgadinho Ruffles"], total: 48.9, status: "preparing", time: "14:32", eta: 25, store: "Supermercado Central" },
  { id: "ORD-8820", customer: "Ana Lima", items: ["Leite Integral 1L x2", "Pão de Forma"], total: 22.5, status: "confirmed", time: "14:28", eta: 35, store: "Supermercado Central" },
  { id: "ORD-8819", customer: "Rafael Costa", items: ["Frango Inteiro 2kg", "Arroz 5kg", "Feijão 1kg"], total: 89.7, status: "delivering", time: "14:15", eta: 8, store: "Distribuidora Norte" },
  { id: "ORD-8818", customer: "Mariana Souza", items: ["Coca-Cola 2L x3", "Suco Del Valle"], total: 36.2, status: "delivered", time: "13:58", eta: 0, store: "Supermercado Central" },
  { id: "ORD-8817", customer: "Pedro Alves", items: ["Detergente Ypê x3", "Sabão em Pó"], total: 31.4, status: "delivered", time: "13:42", eta: 0, store: "Mercadinho Bela Vista" },
  { id: "ORD-8816", customer: "Fernanda Reis", items: ["Yogurt Activia x4", "Granola"], total: 28.9, status: "pending", time: "14:35", eta: 40, store: "Distribuidora Norte" },
];

const MOCK_PRODUCTS = [
  { id: "P001", name: "Cerveja Skol 350ml", sku: "CRV-SKL-350", price: 4.99, stock: 240, category: "Bebidas", synced: true, ifoodId: "IFD-8821" },
  { id: "P002", name: "Coca-Cola 2L", sku: "COC-2L", price: 9.5, stock: 85, category: "Bebidas", synced: true, ifoodId: "IFD-8822" },
  { id: "P003", name: "Arroz Tio João 5kg", sku: "ARR-TJ-5K", price: 28.9, stock: 12, category: "Grãos", synced: true, ifoodId: "IFD-8823" },
  { id: "P004", name: "Feijão Carioca 1kg", sku: "FEJ-CAR-1K", price: 8.5, stock: 0, category: "Grãos", synced: false, ifoodId: null },
  { id: "P005", name: "Leite Integral 1L", sku: "LTE-INT-1L", price: 5.2, stock: 156, category: "Laticínios", synced: true, ifoodId: "IFD-8825" },
  { id: "P006", name: "Pão de Forma Pullman", sku: "PAO-PUL", price: 7.9, stock: 34, category: "Padaria", synced: true, ifoodId: "IFD-8826" },
  { id: "P007", name: "Frango Inteiro Resfriado", sku: "FRG-INT", price: 18.9, stock: 28, category: "Carnes", synced: false, ifoodId: null },
  { id: "P008", name: "Detergente Ypê 500ml", sku: "DET-YPE-500", price: 3.8, stock: 73, category: "Limpeza", synced: true, ifoodId: "IFD-8828" },
];

const MOCK_STORES = [
  { id: "S1", name: "Supermercado Central", status: "open", ordersToday: 47, revenue: 2840.5, ifoodConnected: true },
  { id: "S2", name: "Distribuidora Norte", status: "open", ordersToday: 23, revenue: 1420.9, ifoodConnected: true },
  { id: "S3", name: "Mercadinho Bela Vista", status: "paused", ordersToday: 8, revenue: 310.2, ifoodConnected: true },
];

const MOCK_LOGS = [
  { id: 1, time: "14:35:12", type: "webhook", message: "Pedido ORD-8821 recebido via Webhook", status: "success" },
  { id: 2, time: "14:35:10", type: "api", message: "Token OAuth2 renovado com sucesso", status: "success" },
  { id: 3, time: "14:34:45", type: "polling", message: "Polling executado — 0 novos pedidos", status: "info" },
  { id: 4, time: "14:33:22", type: "sync", message: "Produto 'Feijão Carioca' sincronizado com iFood", status: "success" },
  { id: 5, time: "14:32:11", type: "webhook", message: "Pedido ORD-8820 recebido via Webhook", status: "success" },
  { id: 6, time: "14:31:00", type: "api", message: "Falha ao atualizar estoque — retry em 5s", status: "error" },
  { id: 7, time: "14:30:55", type: "polling", message: "Polling executado — 1 novo pedido", status: "info" },
  { id: 8, time: "14:29:10", type: "sync", message: "Preço atualizado: Coca-Cola 2L → R$ 9,50", status: "success" },
];

// ─── Utilities ─────────────────────────────────────────────────────────────────
const statusConfig = {
  pending:    { label: "Aguardando", color: "#F59E0B", bg: "rgba(245,158,11,0.15)", icon: "⏳" },
  confirmed:  { label: "Confirmado", color: "#3B82F6", bg: "rgba(59,130,246,0.15)", icon: "✓" },
  preparing:  { label: "Preparando", color: "#8B5CF6", bg: "rgba(139,92,246,0.15)", icon: "🍳" },
  delivering: { label: "Em Entrega", color: "#10B981", bg: "rgba(16,185,129,0.15)", icon: "🛵" },
  delivered:  { label: "Entregue",   color: "#6B7280", bg: "rgba(107,114,128,0.15)", icon: "✅" },
};

const logConfig = {
  webhook: { color: "#3B82F6", label: "WEBHOOK" },
  api:     { color: "#8B5CF6", label: "API" },
  polling: { color: "#F59E0B", label: "POLLING" },
  sync:    { color: "#10B981", label: "SYNC" },
};

// ─── Components ────────────────────────────────────────────────────────────────
function TopBar({ activeStore, setActiveStore, lastSync, pollingCountdown }) {
  return (
    <header style={{
      background: "rgba(10,12,18,0.95)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "0 28px",
      height: 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: "linear-gradient(135deg, #EA1D2C, #C1121F)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>🛒</div>
          <span style={{ color: "#fff", fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>
            iFood<span style={{ color: "#EA1D2C" }}>Hub</span>
          </span>
          <span style={{ color: "#4B5563", fontSize: 11, fontFamily: "monospace" }}>v2.1.0</span>
        </div>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />

        <select
          value={activeStore}
          onChange={e => setActiveStore(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#D1D5DB",
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 13,
            fontFamily: "'DM Mono', monospace",
            cursor: "pointer",
          }}
        >
          <option value="all">Todas as Lojas</option>
          {MOCK_STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#10B981",
            boxShadow: "0 0 0 3px rgba(16,185,129,0.2)",
            animation: "pulse 2s infinite",
          }} />
          <span style={{ color: "#6B7280", fontSize: 12, fontFamily: "monospace" }}>
            iFood API <span style={{ color: "#10B981" }}>ONLINE</span>
          </span>
        </div>
        <div style={{ color: "#4B5563", fontSize: 12, fontFamily: "monospace" }}>
          Polling em <span style={{ color: "#F59E0B" }}>{pollingCountdown}s</span>
        </div>
        <div style={{ color: "#4B5563", fontSize: 12, fontFamily: "monospace" }}>
          Sync: <span style={{ color: "#6B7280" }}>{lastSync}</span>
        </div>
        <div style={{
          width: 32, height: 32,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          color: "#9CA3AF",
          fontSize: 14,
        }}>⚙</div>
      </div>
    </header>
  );
}

function Sidebar({ active, setActive }) {
  const nav = [
    { id: "dashboard", icon: "◈", label: "Dashboard" },
    { id: "orders", icon: "📋", label: "Pedidos" },
    { id: "products", icon: "📦", label: "Produtos" },
    { id: "inventory", icon: "🗃", label: "Estoque" },
    { id: "stores", icon: "🏪", label: "Lojas" },
    { id: "automation", icon: "⚡", label: "Automação" },
    { id: "logs", icon: "📡", label: "API Logs" },
    { id: "reports", icon: "📊", label: "Relatórios" },
    { id: "settings", icon: "🔧", label: "Configurações" },
  ];

  return (
    <aside style={{
      width: 220,
      background: "rgba(10,12,18,0.8)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      padding: "16px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      flexShrink: 0,
    }}>
      {nav.map(item => (
        <button
          key={item.id}
          onClick={() => setActive(item.id)}
          style={{
            background: active === item.id ? "rgba(234,29,44,0.15)" : "transparent",
            border: active === item.id ? "1px solid rgba(234,29,44,0.3)" : "1px solid transparent",
            borderRadius: 8,
            padding: "9px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            color: active === item.id ? "#EA1D2C" : "#6B7280",
            fontSize: 13,
            fontFamily: "'DM Mono', monospace",
            fontWeight: active === item.id ? 600 : 400,
            textAlign: "left",
            transition: "all 0.15s",
            width: "100%",
          }}
        >
          <span style={{ fontSize: 15 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{
        background: "rgba(234,29,44,0.08)",
        border: "1px solid rgba(234,29,44,0.2)",
        borderRadius: 8,
        padding: "12px",
        marginTop: 8,
      }}>
        <div style={{ color: "#EA1D2C", fontSize: 11, fontFamily: "monospace", fontWeight: 700, marginBottom: 4 }}>
          PLANO PRO
        </div>
        <div style={{ color: "#6B7280", fontSize: 11, fontFamily: "monospace" }}>
          3 lojas • Ilimitado pedidos
        </div>
      </div>
    </aside>
  );
}

function StatCard({ label, value, sub, color = "#EA1D2C", icon }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      padding: "20px 24px",
      flex: 1,
      minWidth: 180,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: 3,
        background: `linear-gradient(to bottom, ${color}, transparent)`,
        borderRadius: "0 12px 12px 0",
      }} />
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ color: "#9CA3AF", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ color: "#F9FAFB", fontSize: 28, fontFamily: "'DM Mono', monospace", fontWeight: 700, letterSpacing: "-0.03em" }}>
        {value}
      </div>
      {sub && <div style={{ color: "#4B5563", fontSize: 12, fontFamily: "monospace", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function OrderCard({ order, onUpdateStatus }) {
  const cfg = statusConfig[order.status];
  const nextStatus = {
    pending: "confirmed",
    confirmed: "preparing",
    preparing: "delivering",
    delivering: "delivered",
  };
  const nextLabel = {
    pending: "Confirmar",
    confirmed: "Iniciar Preparo",
    preparing: "Saiu p/ Entrega",
    delivering: "Finalizar",
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid rgba(255,255,255,0.07)`,
      borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 10,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ color: "#EA1D2C", fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{order.id}</span>
            <span style={{
              background: cfg.bg,
              color: cfg.color,
              fontSize: 11,
              fontFamily: "monospace",
              padding: "2px 8px",
              borderRadius: 4,
            }}>{cfg.icon} {cfg.label}</span>
          </div>
          <div style={{ color: "#F9FAFB", fontSize: 14, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{order.customer}</div>
          <div style={{ color: "#6B7280", fontSize: 11, fontFamily: "monospace", marginTop: 2 }}>{order.store}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#10B981", fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700 }}>
            R$ {order.total.toFixed(2)}
          </div>
          <div style={{ color: "#4B5563", fontSize: 11, fontFamily: "monospace" }}>{order.time}</div>
          {order.eta > 0 && (
            <div style={{
              color: order.eta < 10 ? "#EF4444" : "#F59E0B",
              fontSize: 11,
              fontFamily: "monospace",
            }}>ETA: {order.eta}min</div>
          )}
        </div>
      </div>

      <div style={{ color: "#9CA3AF", fontSize: 12, fontFamily: "monospace" }}>
        {order.items.join(" • ")}
      </div>

      {nextStatus[order.status] && (
        <button
          onClick={() => onUpdateStatus(order.id, nextStatus[order.status])}
          style={{
            background: `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}11)`,
            border: `1px solid ${cfg.color}44`,
            color: cfg.color,
            borderRadius: 6,
            padding: "7px 14px",
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
            transition: "all 0.15s",
          }}
        >
          → {nextLabel[order.status]}
        </button>
      )}
    </div>
  );
}

// ─── Views ─────────────────────────────────────────────────────────────────────
function DashboardView({ orders, onUpdateStatus }) {
  const pending    = orders.filter(o => o.status === "pending").length;
  const preparing  = orders.filter(o => o.status === "preparing" || o.status === "confirmed").length;
  const delivering = orders.filter(o => o.status === "delivering").length;
  const revenue    = orders.reduce((s, o) => s + o.total, 0);

  const hours = Array.from({ length: 8 }, (_, i) => ({
    h: `${10 + i}h`,
    v: Math.floor(Math.random() * 18) + 3,
  }));
  const maxV = Math.max(...hours.map(h => h.v));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard icon="⏳" label="Aguardando" value={pending} sub="requer ação" color="#F59E0B" />
        <StatCard icon="🍳" label="Em Preparo" value={preparing} sub="lojas ativas" color="#8B5CF6" />
        <StatCard icon="🛵" label="Em Entrega" value={delivering} sub="em trânsito" color="#10B981" />
        <StatCard icon="💰" label="Receita Hoje" value={`R$${revenue.toFixed(0)}`} sub="78 pedidos" color="#EA1D2C" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Chart */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: "20px 24px",
        }}>
          <div style={{ color: "#9CA3AF", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 16 }}>
            PEDIDOS POR HORA
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
            {hours.map((h, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: "100%",
                  height: (h.v / maxV) * 80,
                  background: `linear-gradient(to top, #EA1D2C, #EA1D2C88)`,
                  borderRadius: "4px 4px 0 0",
                  minHeight: 4,
                }} />
                <span style={{ color: "#4B5563", fontSize: 10, fontFamily: "monospace" }}>{h.h}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: "20px 24px",
        }}>
          <div style={{ color: "#9CA3AF", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 16 }}>
            PRODUTOS MAIS VENDIDOS
          </div>
          {[
            ["Cerveja Skol 350ml", 142, "#EA1D2C"],
            ["Coca-Cola 2L", 98, "#3B82F6"],
            ["Arroz Tio João 5kg", 67, "#10B981"],
            ["Frango Inteiro", 45, "#F59E0B"],
          ].map(([name, qty, color]) => (
            <div key={name} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#D1D5DB", fontSize: 12, fontFamily: "monospace" }}>{name}</span>
                <span style={{ color, fontSize: 12, fontFamily: "monospace", fontWeight: 700 }}>{qty}</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div style={{ width: `${(qty / 142) * 100}%`, height: "100%", background: color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Orders */}
      <div>
        <div style={{ color: "#9CA3AF", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 12 }}>
          PEDIDOS ATIVOS — {orders.filter(o => o.status !== "delivered").length} em andamento
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {orders.filter(o => o.status !== "delivered").map(o => (
            <OrderCard key={o.id} order={o} onUpdateStatus={onUpdateStatus} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdersView({ orders, onUpdateStatus }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ color: "#F9FAFB", fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, margin: 0 }}>
          Central de Pedidos
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "pending", "confirmed", "preparing", "delivering", "delivered"].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                background: filter === s ? "rgba(234,29,44,0.2)" : "rgba(255,255,255,0.04)",
                border: filter === s ? "1px solid rgba(234,29,44,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: filter === s ? "#EA1D2C" : "#6B7280",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 11,
                fontFamily: "monospace",
                cursor: "pointer",
              }}
            >
              {s === "all" ? "Todos" : statusConfig[s]?.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {filtered.map(o => (
          <OrderCard key={o.id} order={o} onUpdateStatus={onUpdateStatus} />
        ))}
      </div>
    </div>
  );
}

function ProductsView({ products, setProducts }) {
  const [search, setSearch] = useState("");
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const syncProduct = (id) => {
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, synced: true, ifoodId: `IFD-${Math.floor(Math.random() * 9000 + 1000)}` } : p
    ));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ color: "#F9FAFB", fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, margin: 0 }}>
          Catálogo de Produtos
        </h2>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto, SKU..."
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#D1D5DB",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontFamily: "monospace",
              width: 240,
            }}
          />
          <button style={{
            background: "linear-gradient(135deg, #EA1D2C, #C1121F)",
            border: "none",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 600,
            cursor: "pointer",
          }}>+ Produto</button>
        </div>
      </div>

      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Produto", "SKU", "Preço", "Estoque", "Categoria", "iFood", "Ações"].map(h => (
                <th key={h} style={{
                  color: "#4B5563",
                  fontSize: 11,
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                  textAlign: "left",
                  padding: "12px 16px",
                  fontWeight: 600,
                }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} style={{
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
              }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ color: "#F9FAFB", fontFamily: "monospace", fontSize: 13 }}>{p.name}</div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ color: "#6B7280", fontFamily: "monospace", fontSize: 12 }}>{p.sku}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ color: "#10B981", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600 }}>
                    R$ {p.price.toFixed(2)}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    color: p.stock === 0 ? "#EF4444" : p.stock < 15 ? "#F59E0B" : "#10B981",
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {p.stock === 0 ? "ZERADO" : p.stock}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ color: "#9CA3AF", fontFamily: "monospace", fontSize: 12 }}>{p.category}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {p.synced ? (
                    <span style={{ color: "#10B981", fontFamily: "monospace", fontSize: 11 }}>✓ {p.ifoodId}</span>
                  ) : (
                    <span style={{ color: "#EF4444", fontFamily: "monospace", fontSize: 11 }}>✗ Não sincronizado</span>
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!p.synced && (
                      <button
                        onClick={() => syncProduct(p.id)}
                        style={{
                          background: "rgba(16,185,129,0.15)",
                          border: "1px solid rgba(16,185,129,0.3)",
                          color: "#10B981",
                          borderRadius: 5,
                          padding: "4px 10px",
                          fontSize: 11,
                          fontFamily: "monospace",
                          cursor: "pointer",
                        }}
                      >↑ Sync</button>
                    )}
                    <button style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#9CA3AF",
                      borderRadius: 5,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontFamily: "monospace",
                      cursor: "pointer",
                    }}>✎ Editar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StoresView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ color: "#F9FAFB", fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, margin: 0 }}>
          Gestão de Lojas
        </h2>
        <button style={{
          background: "linear-gradient(135deg, #EA1D2C, #C1121F)",
          border: "none",
          color: "#fff",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontFamily: "'DM Mono', monospace",
          fontWeight: 600,
          cursor: "pointer",
        }}>+ Conectar Loja</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {MOCK_STORES.map(store => (
          <div key={store.id} style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            padding: "20px 24px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ color: "#F9FAFB", fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {store.name}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{
                    background: store.status === "open" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                    color: store.status === "open" ? "#10B981" : "#F59E0B",
                    fontSize: 11,
                    fontFamily: "monospace",
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}>{store.status === "open" ? "● ABERTA" : "⏸ PAUSADA"}</span>
                  {store.ifoodConnected && (
                    <span style={{
                      background: "rgba(234,29,44,0.15)",
                      color: "#EA1D2C",
                      fontSize: 11,
                      fontFamily: "monospace",
                      padding: "2px 8px",
                      borderRadius: 4,
                    }}>iFood ✓</span>
                  )}
                </div>
              </div>
              <button style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#9CA3AF",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 11,
                fontFamily: "monospace",
                cursor: "pointer",
              }}>Gerenciar</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["Pedidos Hoje", store.ordersToday, "#3B82F6"],
                ["Receita", `R$${store.revenue.toFixed(0)}`, "#10B981"],
              ].map(([l, v, c]) => (
                <div key={l} style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}>
                  <div style={{ color: "#6B7280", fontSize: 10, fontFamily: "monospace", marginBottom: 4 }}>{l.toUpperCase()}</div>
                  <div style={{ color: c, fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationView() {
  const [rules, setRules] = useState([
    { id: 1, name: "Auto-confirmar pedidos", desc: "Confirma automaticamente pedidos abaixo de R$150", enabled: true, type: "order" },
    { id: 2, name: "Pausar loja com estoque zero", desc: "Pausa loja quando produto crítico zerar estoque", enabled: true, type: "stock" },
    { id: 3, name: "Alerta WhatsApp pedido novo", desc: "Envia notificação WhatsApp para cada pedido recebido", enabled: false, type: "notify" },
    { id: 4, name: "Ajuste automático de preço", desc: "Aumenta 5% nas horas de pico (18h–21h)", enabled: false, type: "price" },
    { id: 5, name: "Retry automático de falhas API", desc: "Reenvio automático em até 3 tentativas com backoff", enabled: true, type: "api" },
  ]);

  const typeColors = { order: "#3B82F6", stock: "#F59E0B", notify: "#10B981", price: "#8B5CF6", api: "#EA1D2C" };
  const typeIcons = { order: "📋", stock: "📦", notify: "📱", price: "💰", api: "🔄" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ color: "#F9FAFB", fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, margin: 0 }}>
        Automação Inteligente
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rules.map(rule => (
          <div key={rule.id} style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid rgba(255,255,255,0.07)`,
            borderLeft: `3px solid ${rule.enabled ? typeColors[rule.type] : "#374151"}`,
            borderRadius: 10,
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ fontSize: 20 }}>{typeIcons[rule.type]}</span>
              <div>
                <div style={{ color: "#F9FAFB", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600, marginBottom: 3 }}>
                  {rule.name}
                </div>
                <div style={{ color: "#6B7280", fontFamily: "monospace", fontSize: 12 }}>{rule.desc}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                color: rule.enabled ? typeColors[rule.type] : "#4B5563",
                fontFamily: "monospace",
                fontSize: 11,
              }}>{rule.enabled ? "ATIVO" : "INATIVO"}</span>
              <div
                onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? {...r, enabled: !r.enabled} : r))}
                style={{
                  width: 44,
                  height: 24,
                  background: rule.enabled ? typeColors[rule.type] : "#374151",
                  borderRadius: 12,
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 3, left: rule.enabled ? 23 : 3,
                  width: 18, height: 18,
                  background: "#fff",
                  borderRadius: "50%",
                  transition: "left 0.2s",
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsView() {
  const [logs, setLogs] = useState(MOCK_LOGS);
  const logColors = { success: "#10B981", error: "#EF4444", info: "#3B82F6" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ color: "#F9FAFB", fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, margin: 0 }}>
          API Logs & Monitoramento
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 8,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", animation: "pulse 1.5s infinite" }} />
            <span style={{ color: "#10B981", fontSize: 12, fontFamily: "monospace" }}>iFood API Online</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          ["Chamadas Hoje", "2,847", "#3B82F6"],
          ["Taxa de Sucesso", "99.2%", "#10B981"],
          ["Erros (24h)", "23", "#EF4444"],
        ].map(([l, v, c]) => (
          <div key={l} style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
            padding: "16px 20px",
          }}>
            <div style={{ color: "#6B7280", fontSize: 11, fontFamily: "monospace", marginBottom: 6 }}>{l.toUpperCase()}</div>
            <div style={{ color: c, fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{
        background: "#0A0C12",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: "'DM Mono', monospace",
      }}>
        <div style={{
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
          <span style={{ color: "#4B5563", fontSize: 11, marginLeft: 8 }}>live-api-monitor.log</span>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {logs.map(log => (
            <div key={log.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: "#4B5563", fontSize: 12, flexShrink: 0 }}>{log.time}</span>
              <span style={{
                background: `${logConfig[log.type].color}22`,
                color: logConfig[log.type].color,
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 3,
                flexShrink: 0,
                fontWeight: 700,
              }}>{logConfig[log.type].label}</span>
              <span style={{ color: logColors[log.status], fontSize: 13 }}>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsView() {
  const [token, setToken] = useState("eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...");
  const [merchantId, setMerchantId] = useState("merchant-uuid-8821-abcd");
  const [sandbox, setSandbox] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 700 }}>
      <h2 style={{ color: "#F9FAFB", fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, margin: 0 }}>
        Configurações & iFood OAuth2
      </h2>

      {[
        { label: "Client ID (iFood)", val: "ifhub-client-abc123", placeholder: "Seu Client ID" },
        { label: "Client Secret", val: "••••••••••••••••••••", placeholder: "Seu Client Secret" },
        { label: "Merchant ID", val: merchantId, placeholder: "UUID da loja", set: setMerchantId },
        { label: "Access Token (atual)", val: token, placeholder: "Bearer token", set: setToken },
      ].map(({ label, val, placeholder, set }) => (
        <div key={label}>
          <label style={{ color: "#9CA3AF", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
            {label.toUpperCase()}
          </label>
          <input
            defaultValue={val}
            onChange={e => set?.(e.target.value)}
            placeholder={placeholder}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#D1D5DB",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontFamily: "monospace",
              boxSizing: "border-box",
            }}
          />
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "16px 20px" }}>
        <div>
          <div style={{ color: "#F9FAFB", fontFamily: "monospace", fontSize: 14, fontWeight: 600 }}>Modo Sandbox</div>
          <div style={{ color: "#6B7280", fontFamily: "monospace", fontSize: 12 }}>Use ambiente de testes iFood</div>
        </div>
        <div onClick={() => setSandbox(v => !v)} style={{
          width: 44, height: 24,
          background: sandbox ? "#F59E0B" : "#374151",
          borderRadius: 12, cursor: "pointer", position: "relative", transition: "background 0.2s",
        }}>
          <div style={{
            position: "absolute", top: 3, left: sandbox ? 23 : 3,
            width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: "left 0.2s",
          }} />
        </div>
      </div>

      <div style={{
        background: "rgba(234,29,44,0.06)",
        border: "1px solid rgba(234,29,44,0.2)",
        borderRadius: 10,
        padding: "16px 20px",
      }}>
        <div style={{ color: "#EA1D2C", fontFamily: "monospace", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          ⚠ Webhook Endpoint
        </div>
        <code style={{ color: "#D1D5DB", fontFamily: "monospace", fontSize: 12 }}>
          https://api.ifoodhub.com/webhooks/ifood/events
        </code>
        <div style={{ color: "#6B7280", fontFamily: "monospace", fontSize: 11, marginTop: 6 }}>
          Configure este URL no painel iFood Developer como endpoint de Webhooks
        </div>
      </div>

      <button style={{
        background: "linear-gradient(135deg, #EA1D2C, #C1121F)",
        border: "none",
        color: "#fff",
        borderRadius: 8,
        padding: "12px 24px",
        fontSize: 14,
        fontFamily: "'DM Mono', monospace",
        fontWeight: 700,
        cursor: "pointer",
        width: "fit-content",
      }}>Salvar Configurações</button>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [activeStore, setActiveStore] = useState("all");
  const [pollingCountdown, setPollingCountdown] = useState(30);
  const [lastSync, setLastSync] = useState("14:35:12");

  // Polling simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setPollingCountdown(c => {
        if (c <= 1) {
          setLastSync(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate incoming order
  useEffect(() => {
    const t = setTimeout(() => {
      setOrders(prev => [{
        id: "ORD-8822",
        customer: "João Ferreira",
        items: ["Água Mineral 1.5L x6"],
        total: 19.9,
        status: "pending",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        eta: 45,
        store: "Supermercado Central",
      }, ...prev]);
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  const updateStatus = (id, newStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  const views = {
    dashboard:  <DashboardView orders={orders} onUpdateStatus={updateStatus} />,
    orders:     <OrdersView orders={orders} onUpdateStatus={updateStatus} />,
    products:   <ProductsView products={products} setProducts={setProducts} />,
    inventory:  <ProductsView products={products} setProducts={setProducts} />,
    stores:     <StoresView />,
    automation: <AutomationView />,
    logs:       <LogsView />,
    reports:    <div style={{ color: "#6B7280", fontFamily: "monospace", padding: 40, textAlign: "center" }}>📊 Módulo de Relatórios em breve</div>,
    settings:   <SettingsView />,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080A10; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        input:focus { outline: 1px solid rgba(234,29,44,0.4); }
        @keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:0.4 } }
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#080A10",
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
      }}>
        <TopBar
          activeStore={activeStore}
          setActiveStore={setActiveStore}
          lastSync={lastSync}
          pollingCountdown={pollingCountdown}
        />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar active={active} setActive={setActive} />

          <main style={{
            flex: 1,
            padding: "28px 32px",
            overflowY: "auto",
            background: "radial-gradient(ellipse at 20% 0%, rgba(234,29,44,0.04) 0%, transparent 60%)",
          }}>
            {views[active]}
          </main>
        </div>
      </div>
    </>
  );
}
