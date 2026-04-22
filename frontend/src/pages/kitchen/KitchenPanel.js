import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../api";

function timeSince(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
}

function aggregateItems(items = []) {
  const map = {};
  items.forEach((item) => {
    const key = item.item || item.name || "";
    if (map[key]) {
      map[key].quantity += Number(item.quantity) || 1;
    } else {
      map[key] = { ...item, quantity: Number(item.quantity) || 1 };
    }
  });
  return Object.values(map);
}

export default function KitchenPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try { const res = await API.get("/admin/kitchen"); setOrders(res.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  const updateStatus = async (orderId, status) => {
    setUpdating(orderId);
    try { await API.put(`/orders/${orderId}/status`, { status }); await load(); } catch {}
    setUpdating(null);
  };

  const handleLogout = async () => {
    try { await API.post("/auth/logout"); } catch {}
    logout(); navigate("/kitchen");
  };

  const pending      = orders.filter(o => o.status === "pending");
  const preparing    = orders.filter(o => o.status === "preparing");
  const takeawayCount = orders.filter(o => o.order_type === "takeaway").length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column" }}>

      {/* ── HEADER ── responsive: wraps on mobile */}
      <header className="kitchen-header">
        {/* Left: logo + title */}
        <div className="kitchen-header-left">
          <div style={{
            width: 40, height: 40, background: "var(--gradient-brand)", borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 19, boxShadow: "var(--shadow-glow)", flexShrink: 0,
          }}>👨‍🍳</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Kitchen Station</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {user?.restaurant_name} · {user?.name}
            </div>
          </div>
        </div>

        {/* Right: stats + controls */}
        <div className="kitchen-header-right">
          {/* Stats bar — moves to new row on xs */}
          <div className="kitchen-stats-bar">
            <span style={{ fontSize: 12, color: "var(--warning)", fontWeight: 700, whiteSpace: "nowrap" }}>
              🕐 {pending.length} Pending
            </span>
            <span style={{ fontSize: 12, color: "var(--info)", fontWeight: 700, whiteSpace: "nowrap" }}>
              🔥 {preparing.length} Preparing
            </span>
            {takeawayCount > 0 && (
              <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, whiteSpace: "nowrap" }}>
                📦 {takeawayCount} Takeaway
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="kitchen-header-controls">
            <button className="theme-toggle" onClick={toggleTheme}>
              <span>{theme === "dark" ? "🌙" : "☀️"}</span>
              <div className="toggle-track"><div className="toggle-thumb" /></div>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={load}>↻</button>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>🚪</button>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍽️</div>
            <h3>No Active Orders</h3>
            <p>Orders from waiters will appear here automatically.</p>
            <p style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              Auto-refreshes every 8 seconds
            </p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div className="kitchen-section-title">
                  <span style={{
                    background: "var(--warning-bg)", color: "var(--warning)",
                    padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  }}>
                    🕐 NEW ORDERS — {pending.length}
                  </span>
                </div>
                <div className="kitchen-grid">
                  {pending.map(order => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      updating={updating === order.id}
                      onPreparing={() => updateStatus(order.id, "preparing")}
                    />
                  ))}
                </div>
              </div>
            )}

            {preparing.length > 0 && (
              <div>
                <div className="kitchen-section-title">
                  <span style={{
                    background: "var(--info-bg)", color: "var(--info)",
                    padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  }}>
                    🔥 PREPARING — {preparing.length}
                  </span>
                </div>
                <div className="kitchen-grid">
                  {preparing.map(order => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      updating={updating === order.id}
                      onServed={() => updateStatus(order.id, "served")}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KitchenCard({ order, updating, onPreparing, onServed }) {
  const [elapsed, setElapsed] = useState(timeSince(order.created_at));
  const isTakeaway = order.order_type === "takeaway";

  useEffect(() => {
    const t = setInterval(() => setElapsed(timeSince(order.created_at)), 10000);
    return () => clearInterval(t);
  }, [order.created_at]);

  const isUrgent = (Date.now() - new Date(order.created_at)) > 15 * 60 * 1000;
  const aggregatedItems = aggregateItems(order.items);

  return (
    <div
      className={`kitchen-card status-${order.status}`}
      style={{
        borderColor: isUrgent && order.status === "pending" ? "var(--danger)" : isTakeaway ? "#f59e0b" : undefined,
        borderWidth: isTakeaway ? 2 : 1,
      }}
    >
      {/* Coloured top banner */}
      <div style={{
        borderRadius: "10px 10px 0 0",
        margin: "-1px -1px 12px -1px",
        padding: "10px 14px",
        background: isTakeaway
          ? "linear-gradient(135deg,#f59e0b,#d97706)"
          : "linear-gradient(135deg,#3b82f6,#2563eb)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{isTakeaway ? "📦" : "🪑"}</span>
        <span style={{
          color: "#fff", fontWeight: 900, fontSize: 14,
          letterSpacing: 1, textTransform: "uppercase",
          textShadow: "0 1px 3px rgba(0,0,0,0.3)",
          textAlign: "center",
        }}>
          {isTakeaway
            ? (order.table_number ? `TAKEAWAY (Table ${order.table_number})` : "TAKEAWAY ORDER")
            : `TABLE ${order.table_number}`}
        </span>
      </div>

      <div className="kitchen-card-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Order #{order.id}</div>
            {isUrgent && order.status === "pending" && (
              <div style={{
                background: "var(--danger-bg)", color: "var(--danger)",
                padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              }} className="animate-pulse">⚠️ URGENT</div>
            )}
          </div>
          {order.waiter_name && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              👤 {order.waiter_name}
            </div>
          )}
          {isTakeaway && (
            <div style={{
              fontSize: 11, color: "#f59e0b", fontWeight: 700, marginTop: 3,
              background: "#fef9c3", padding: "2px 8px", borderRadius: 20,
              display: "inline-block",
            }}>
              📦 Pack for Takeaway{order.table_number ? ` — Table ${order.table_number}` : ""}
            </div>
          )}
        </div>
        <div className="kitchen-timer">🕐 {elapsed}</div>
      </div>

      <div className="kitchen-card-body">
        {aggregatedItems.map((item, i) => (
          <div key={i} className="kitchen-item">
            <div style={{ minWidth: 0 }}>
              <div className="kitchen-item-name">{item.item || item.name}</div>
              {item.category && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>
                  {item.category}
                </div>
              )}
            </div>
            <div className="kitchen-item-qty" style={{
              background: item.quantity > 1 ? "rgba(245,158,11,0.15)" : undefined,
              color: item.quantity > 1 ? "#d97706" : undefined,
              fontWeight: item.quantity > 1 ? 900 : 700,
              fontSize: item.quantity > 1 ? 17 : 14,
              padding: "4px 10px", borderRadius: 8, minWidth: 38, textAlign: "center",
            }}>
              ×{item.quantity}
            </div>
          </div>
        ))}
        {order.notes && (
          <div style={{
            marginTop: 10, padding: "8px 10px",
            background: "var(--warning-bg)", borderRadius: 8,
            fontSize: 12, color: "var(--warning)", fontWeight: 500,
          }}>
            📝 {order.notes}
          </div>
        )}
      </div>

      <div className="kitchen-card-footer">
        {order.status === "pending" && (
          <button className="btn btn-warning" style={{ flex: 1 }} onClick={onPreparing} disabled={updating}>
            {updating ? <span className="spinner-sm" /> : "🔥"} Start Preparing
          </button>
        )}
        {order.status === "preparing" && (
          <button className="btn btn-success" style={{ flex: 1 }} onClick={onServed} disabled={updating}>
            {updating ? <span className="spinner-sm" /> : (isTakeaway ? "📦" : "✅")}
            {" "}{isTakeaway ? "Ready for Pickup" : "Mark Served"}
          </button>
        )}
      </div>
    </div>
  );
}