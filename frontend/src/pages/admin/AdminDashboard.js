import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Papa from "papaparse"; // npm install papaparse
import API from "../../api";

const TABS = [
  { id: "overview",    label: "Overview",         icon: "📊", section: "main" },
  { id: "orders",      label: "Orders",            icon: "🧾", section: "main" },
  { id: "kitchen",     label: "Kitchen Orders",    icon: "👨‍🍳", section: "main" },
  { id: "tables",      label: "Tables",            icon: "🪑", section: "manage" },
  { id: "menu",        label: "Menu",              icon: "🍔", section: "manage" },
  { id: "inventory",   label: "Inventory",         icon: "📦", section: "manage" },
  { id: "users",       label: "Staff",             icon: "👥", section: "manage" },
  { id: "specials",    label: "Daily Specials",    icon: "⭐", section: "manage" },
  { id: "credits",     label: "Credit Payments",   icon: "💳", section: "finance" },
  { id: "income",      label: "Income & Expenses", icon: "💹", section: "finance" },
  { id: "expenses",    label: "Expense Entry",     icon: "💸", section: "finance" },
  { id: "waste",       label: "Waste Log",         icon: "🗑️", section: "finance" },
  { id: "insights",    label: "Smart Insights",    icon: "🧠", section: "finance" },
  { id: "attendance",  label: "Attendance",        icon: "📋", section: "hr" },
  { id: "notifications", label: "Notifications",  icon: "🔔", section: "hr" },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const loadNotifs = React.useCallback(async () => {
    try {
      const res = await API.get("/notifications");
      setNotifs(res.data);
    } catch {}
  }, []);

  React.useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 60000);
    return () => clearInterval(t);
  }, [loadNotifs]);

  const markRead = async (id) => {
    try { await API.put(`/notifications/${id}/read`); await loadNotifs(); } catch {}
  };

  const markAllRead = async () => {
    try { await API.put("/notifications/read-all"); await loadNotifs(); } catch {}
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const handleLogout = async () => {
    try { await API.post("/auth/logout"); } catch {}
    logout(); navigate("/");
  };

  const sections = [
    { id: "main",    label: "Operations" },
    { id: "manage",  label: "Management" },
    { id: "finance", label: "Finance" },
    { id: "hr",      label: "HR" },
  ];

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            {user?.restaurant_logo
              ? <img src={user.restaurant_logo} alt="logo"
                  style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} />
              : <div className="logo-icon">🍽️</div>
            }
            <h2>RestoPOS</h2>
          </div>
          <div className="restaurant-name">{user?.restaurant_name}</div>
          <div className="brand-role">Admin Panel</div>
        </div>
        <nav>
          {sections.map(sec => (
            <div key={sec.id}>
              <div className="nav-section-label">{sec.label}</div>
              {TABS.filter(t => t.section === sec.id).map(t => (
                <button
                  key={t.id}
                  className={`nav-item ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  <span className="nav-icon">{t.icon}</span>{t.label}
                  {t.id === "notifications" && unreadCount > 0 && (
                    <span className="nav-badge">{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">Admin · {user?.restaurant_name}</div>
          </div>
          <button className="nav-item" onClick={toggleTheme}>
            <span className="nav-icon">{theme === "dark" ? "🌙" : "☀️"}</span>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="nav-item" onClick={handleLogout}>
            <span className="nav-icon">🚪</span>Logout
          </button>
        </div>
      </aside>

      <div className="main-content">
        {tab === "overview"       && <OverviewTab onNotifClick={() => setTab("notifications")} unreadCount={unreadCount} />}
        {tab === "orders"         && <OrdersTab />}
        {tab === "kitchen"        && <KitchenTab />}
        {tab === "tables"         && <TablesTab />}
        {tab === "menu"           && <MenuTab />}
        {tab === "inventory"      && <InventoryTab />}
        {tab === "users"          && <UsersTab />}
        {tab === "specials"       && <DailySpecialsTab />}
        {tab === "credits"        && <CreditsTab />}
        {tab === "income"         && <IncomeExpenditureTab />}
        {tab === "expenses"       && <ExpensesTab />}
        {tab === "waste"          && <WasteLogTab />}
        {tab === "insights"       && <InsightsTab />}
        {tab === "attendance"     && <AttendanceTab />}
        {tab === "notifications"  && <NotificationsTab notifs={notifs} onMarkRead={markRead} onMarkAll={markAllRead} onRefresh={loadNotifs} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS TAB (standalone panel — not credits)
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsTab({ notifs, onMarkRead, onMarkAll, onRefresh }) {
  const typeIcon = { credit_due: "💳", subscription_ending: "📅", subscription_expired: "🚫", system: "🔧" };
  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <>
      <div className="page-header">
        <div><h1>Notifications</h1><p>{unread} unread · {notifs.length} total</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          {unread > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={onMarkAll}>✓ Mark All Read</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>↻ Refresh</button>
        </div>
      </div>
      <div className="page-body">
        {notifs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <h3>No notifications</h3>
            <p>Subscription alerts and credit payment notifications will appear here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifs.map(n => (
              <div
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                style={{
                  padding: "14px 18px", borderRadius: 12, cursor: "pointer",
                  background: n.is_read ? "var(--bg-card)" : "var(--bg-surface)",
                  border: `1px solid ${n.is_read ? "var(--border)" : "var(--accent)"}`,
                  display: "flex", gap: 14, alignItems: "flex-start",
                  transition: "all 0.2s",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: n.is_read ? "var(--bg-surface)" : "var(--accent-bg,#eef2ff)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>
                  {typeIcon[n.type] || "🔔"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: n.is_read ? "var(--text-primary)" : "var(--accent)" }}>
                      {n.title}
                    </span>
                    {!n.is_read && (
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: "var(--accent)", flexShrink: 0,
                      }} />
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ onNotifClick, unreadCount = 0 }) {
  const [stats, setStats] = useState({});
  const [sales, setSales] = useState({ daily: [], by_method: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, sl] = await Promise.all([API.get("/admin/stats"), API.get("/admin/sales")]);
      setStats(s.data); setSales(sl.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div><h1>Overview</h1><p>Restaurant performance at a glance</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
          <div className="notif-bell-wrap">
            <button className="btn btn-secondary btn-sm" onClick={onNotifClick} style={{ fontSize: 16, padding: "6px 10px" }}>🔔</button>
            {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          {[
            { icon: "💰", label: "Total Sales", value: `Rs. ${Number(stats.total_sales||0).toLocaleString()}`, color: "success" },
            { icon: "🧾", label: "Total Orders", value: stats.total_orders||0, color: "accent" },
            { icon: "🪑", label: "Tables", value: `${stats.occupied_tables||0}/${stats.total_tables||0}`, color: "warning" },
            { icon: "🍔", label: "Menu Items", value: stats.available_menu_items||0, color: "accent" },
            { icon: "⏳", label: "Active Orders", value: stats.pending_orders||0, color: "warning" },
            { icon: "⚠️", label: "Low Stock", value: stats.low_stock_items||0, color: "danger" },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background: `var(--${s.color}-bg)`, fontSize: 22 }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className={`stat-value ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {sales.daily.length > 0 && (
          <div className="card mt-16">
            <div className="section-title">📈 Recent Daily Sales (Last 30 Days)</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Orders</th><th>Revenue</th></tr></thead>
                <tbody>
                  {sales.daily.slice(0, 10).map((d, i) => (
                    <tr key={i}>
                      <td>{new Date(d.date).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}</td>
                      <td>{d.orders}</td>
                      <td style={{ color: "var(--success)", fontWeight: 700 }}>Rs. {Number(d.revenue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sales.by_method.length > 0 && (
          <div className="card mt-16">
            <div className="section-title">💳 Sales by Payment Method</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {sales.by_method.map((m, i) => (
                <div key={i} style={{
                  flex: 1, minWidth: 120, padding: 20, borderRadius: 12,
                  background: "var(--bg-surface)", border: "1px solid var(--border)", textAlign: "center",
                }}>
                  <div style={{ fontSize: 24 }}>{m.payment_method === "cash" ? "💵" : m.payment_method === "credit" ? "📋" : "📱"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "capitalize", marginTop: 4 }}>
                    {m.payment_method || "N/A"}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--success)", marginTop: 4 }}>
                    Rs. {Number(m.total).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.count} orders</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KITCHEN (admin view)
// ─────────────────────────────────────────────────────────────────────────────
function KitchenTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const load = useCallback(async () => {
    try { const res = await API.get("/admin/kitchen"); setOrders(res.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try { await API.put(`/orders/${id}/status`, { status }); await load(); } catch {}
    setUpdating(null);
  };

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div><h1>Kitchen Orders</h1><p>Live view — auto-refreshes every 10s</p></div>
        <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
      </div>
      <div className="page-body">
        {orders.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🍽️</div><h3>No Active Orders</h3></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 16 }}>
            {orders.map(order => {
              const isTakeaway = order.order_type === "takeaway";
              return (
                <div key={order.id} className={`kitchen-card status-${order.status}`}>
                  {/* Order type banner */}
                  <div style={{
                    margin: "-1px -1px 12px -1px", padding: "8px 14px",
                    borderRadius: "10px 10px 0 0",
                    background: isTakeaway
                      ? "linear-gradient(135deg,#f59e0b,#d97706)"
                      : "linear-gradient(135deg,#3b82f6,#2563eb)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 16 }}>{isTakeaway ? "📦" : "🪑"}</span>
                    <span style={{ color: "#fff", fontWeight: 900, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
                      {isTakeaway ? "TAKEAWAY" : `Table ${order.table_number}`}
                    </span>
                  </div>
                  <div className="kitchen-card-header">
                    <div>
                      <div style={{ fontWeight: 800 }}>Order #{order.id}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{order.waiter_name}</div>
                    </div>
                    <span className={`badge badge-${order.status}`}>{order.status}</span>
                  </div>
                  <div className="kitchen-card-body">
                    {order.items?.map((item, i) => (
                      <div key={i} className="kitchen-item">
                        <span>{item.item}</span>
                        <span className="kitchen-item-qty">×{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="kitchen-card-footer">
                    {order.status === "pending" && (
                      <button className="btn btn-warning btn-sm" style={{ flex: 1 }} disabled={updating === order.id} onClick={() => updateStatus(order.id, "preparing")}>
                        🔥 Preparing
                      </button>
                    )}
                    {order.status === "preparing" && (
                      <button className="btn btn-success btn-sm" style={{ flex: 1 }} disabled={updating === order.id} onClick={() => updateStatus(order.id, "served")}>
                        ✅ Served
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION ITEM SUB-COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function ActionItem({ icon, color, bg, title, action }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      background: bg, border: `1px solid ${color}30`,
      borderRadius: 10, padding: "12px 16px",
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>👉 {action}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INCOME & EXPENDITURE
// ─────────────────────────────────────────────────────────────────────────────
function IncomeExpenditureTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Tax settings
  const [taxSettings, setTaxSettings] = useState({ tax_enabled: true, tax_rate: 13.0 });
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxSaved, setTaxSaved] = useState(false);
  const [taxForm, setTaxForm] = useState({ tax_enabled: true, tax_rate: "13" });

  const loadTaxSettings = useCallback(async () => {
    try {
      const res = await API.get("/admin/settings");
      const s = res.data;
      setTaxSettings(s);
      setTaxForm({ tax_enabled: s.tax_enabled !== false, tax_rate: String(s.tax_rate || 13) });
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await API.get(`/admin/income-expenditure?month=${month}&year=${year}`); setReport(res.data); } catch {}
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadTaxSettings(); }, [loadTaxSettings]);
  useEffect(() => { load(); }, [load]);

  const saveTaxSettings = async () => {
    setTaxSaving(true);
    try {
      const rate = parseFloat(taxForm.tax_rate) || 0;
      await API.put("/admin/settings", { tax_enabled: taxForm.tax_enabled, tax_rate: rate });
      setTaxSettings({ tax_enabled: taxForm.tax_enabled, tax_rate: rate });
      setTaxSaved(true);
      setTimeout(() => setTaxSaved(false), 2500);
      await load(); // reload report with new tax
    } catch {}
    setTaxSaving(false);
  };

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const netColor = report?.net_profit >= 0 ? "var(--success)" : "var(--danger)";

  const exportToExcel = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const monthLabel = months[month - 1];
      const lines = [];
      lines.push(`Income & Expenditure Report — ${monthLabel} ${year}`);
      lines.push("");
      lines.push("SUMMARY");
      lines.push(`Subtotal (from orders),Rs. ${Number(report.income.subtotal).toLocaleString()}`);
      lines.push(`Tax Collected (${report.tax_settings?.tax_rate || 13}%),Rs. ${Number(report.income.tax_collected).toLocaleString()}`);
      lines.push(`Total Revenue,Rs. ${Number(report.income.total).toLocaleString()}`);
      lines.push(`Orders Paid,${report.income.orders}`);
      lines.push(`Total Expenses,Rs. ${Number(report.total_expenses).toLocaleString()}`);
      lines.push(`Net ${report.net_profit >= 0 ? "Profit" : "Loss"},Rs. ${Math.abs(Number(report.net_profit)).toLocaleString()}`);
      lines.push(`Profit Margin,${report.profit_margin}%`);
      lines.push("");
      lines.push("EXPENSE BREAKDOWN");
      lines.push("Category,Type,Amount,% of Total Expenses");
      report.expenses.forEach(e => {
        const pct = report.total_expenses > 0 ? ((e.total / report.total_expenses) * 100).toFixed(1) : 0;
        lines.push(`${e.category},${e.expense_type},${Number(e.total).toLocaleString()},${pct}%`);
      });
      lines.push("");
      lines.push(`Generated on,${new Date().toLocaleString("en-NP")}`);
      const csvContent = lines.join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `income-expenditure-${monthLabel}-${year}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    setExporting(false);
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Income & Expenditure</h1><p>Monthly profit/loss analysis with tax</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: "auto" }}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: "auto" }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={load}>📊 View Report</button>
          {report && (
            <button className="btn btn-secondary btn-sm" onClick={exportToExcel} disabled={exporting}>
              {exporting ? "⏳ Exporting..." : "📥 Download CSV"}
            </button>
          )}
        </div>
      </div>
      <div className="page-body">

        {/* ── TAX SETTINGS CARD ── */}
        <div className="card" style={{ marginBottom: 24, border: "1px solid var(--accent)30" }}>
          <div className="section-title">🧾 Tax / VAT Settings</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            {/* Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Tax / VAT</span>
              <div
                onClick={() => setTaxForm(f => ({ ...f, tax_enabled: !f.tax_enabled }))}
                style={{
                  width: 48, height: 26, borderRadius: 13, cursor: "pointer", transition: "background 0.3s",
                  background: taxForm.tax_enabled ? "var(--success)" : "var(--border)",
                  position: "relative", flexShrink: 0,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 10, background: "#fff",
                  position: "absolute", top: 3, transition: "left 0.3s",
                  left: taxForm.tax_enabled ? 25 : 3,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }} />
              </div>
              <span style={{ fontSize: 13, color: taxForm.tax_enabled ? "var(--success)" : "var(--text-muted)", fontWeight: 700 }}>
                {taxForm.tax_enabled ? "Enabled" : "Disabled"}
              </span>
            </div>

            {/* Rate input */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: taxForm.tax_enabled ? 1 : 0.4, pointerEvents: taxForm.tax_enabled ? "auto" : "none" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Tax Rate</span>
              <input
                type="number" min="0" max="100" step="0.1"
                value={taxForm.tax_rate}
                onChange={e => setTaxForm(f => ({ ...f, tax_rate: e.target.value }))}
                style={{ width: 80, textAlign: "center", fontWeight: 700, fontSize: 15 }}
              />
              <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>%</span>
            </div>

            {/* Save */}
            <button
              className="btn btn-primary btn-sm"
              onClick={saveTaxSettings}
              disabled={taxSaving}
              style={{ fontWeight: 800 }}
            >
              {taxSaving ? <><span className="spinner-sm" /> Saving...</> : taxSaved ? "✅ Saved!" : "💾 Save Settings"}
            </button>

            <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
              Default: 13% VAT (Nepal standard)
            </div>
          </div>
          {taxSaved && (
            <div style={{ marginTop: 12, background: "var(--success-bg)", border: "1px solid var(--success)", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
              ✅ Tax settings saved — new bills will use {taxForm.tax_enabled ? `${taxForm.tax_rate}%` : "no"} tax.
            </div>
          )}
        </div>

        {loading && <div className="flex-center" style={{ padding: 60 }}><div className="spinner" /></div>}
        {!loading && report && (
          <>
            <div className="pnl-summary">
              <div className="pnl-card pnl-income">
                <div className="pnl-label" style={{ color: "var(--success)" }}>📈 Total Revenue (with tax)</div>
                <div className="pnl-amount" style={{ color: "var(--success)" }}>Rs. {Number(report.income.total).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Subtotal: Rs. {Number(report.income.subtotal).toLocaleString()}
                  {report.tax_settings?.tax_enabled && (
                    <> · Tax: Rs. {Number(report.income.tax_collected).toLocaleString()}</>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{report.income.orders} orders paid</div>
              </div>
              <div className="pnl-card pnl-expense">
                <div className="pnl-label" style={{ color: "var(--danger)" }}>📉 Total Expenses</div>
                <div className="pnl-amount" style={{ color: "var(--danger)" }}>Rs. {Number(report.total_expenses).toLocaleString()}</div>
              </div>
              <div className={`pnl-card ${report.net_profit >= 0 ? "pnl-profit" : "pnl-loss"}`}>
                <div className="pnl-label" style={{ color: netColor }}>{report.net_profit >= 0 ? "✅ Net Profit" : "⚠️ Net Loss"}</div>
                <div className="pnl-amount" style={{ color: netColor }}>Rs. {Math.abs(Number(report.net_profit)).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Margin: {report.profit_margin}%</div>
              </div>
            </div>

            {/* ACTIONABLE INSIGHTS */}
            <div className="card" style={{ marginBottom: 24, border: `1px solid ${netColor}30` }}>
              <div className="section-title">🎯 Action Required</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {report.net_profit < 0 && (
                  <ActionItem icon="🚨" color="var(--danger)" bg="var(--danger-bg)"
                    title={`You lost Rs. ${Math.abs(Number(report.net_profit)).toLocaleString()} this month`}
                    action="Cut expenses immediately — start with the largest cost category below" />
                )}
                {report.profit_margin < 20 && report.net_profit >= 0 && (
                  <ActionItem icon="⚠️" color="var(--warning)" bg="var(--warning-bg)"
                    title={`Profit margin is only ${report.profit_margin}%`}
                    action="Target 25%+ margin — review your menu pricing or reduce daily purchase costs" />
                )}
                {report.profit_margin >= 25 && (
                  <ActionItem icon="✅" color="var(--success)" bg="var(--success-bg)"
                    title={`Strong ${report.profit_margin}% profit margin!`}
                    action={`Reinvest Rs. ${Math.round(Number(report.net_profit) * 0.3).toLocaleString()} back into marketing or staff bonuses`} />
                )}
                {report.expenses.length > 0 && (() => {
                  const topExp = [...report.expenses].sort((a, b) => b.total - a.total)[0];
                  const pct = report.total_expenses > 0 ? ((topExp.total / report.total_expenses) * 100).toFixed(0) : 0;
                  return pct > 40 ? (
                    <ActionItem icon="💡" color="var(--info)" bg="var(--info-bg)"
                      title={`"${topExp.category}" is eating ${pct}% of your expenses`}
                      action={`Negotiate better rates for ${topExp.category} — even 10% savings = Rs. ${Math.round(topExp.total * 0.1).toLocaleString()} more profit`} />
                  ) : null;
                })()}
              </div>
            </div>

            {report.expenses.length > 0 && (
              <div className="card">
                <div className="section-title">Expense Breakdown</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Category</th><th>Type</th><th>Amount</th><th>% of Expenses</th></tr></thead>
                    <tbody>
                      {report.expenses.map((e, i) => {
                        const pct = report.total_expenses > 0 ? ((e.total / report.total_expenses) * 100).toFixed(1) : 0;
                        return (
                          <tr key={i}>
                            <td style={{ textTransform: "capitalize", fontWeight: 600 }}>{e.category}</td>
                            <td><span className={`badge ${e.expense_type === "daily" ? "badge-pending" : "badge-preparing"}`}>{e.expense_type}</span></td>
                            <td style={{ color: "var(--danger)", fontWeight: 700 }}>Rs. {Number(e.total).toLocaleString()}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ height: 6, flex: 1, maxWidth: 120, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, background: "var(--gradient-danger)", borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────────────────────────────────────────
function ExpensesTab() {
  const now = new Date();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), type: "" });
  const [form, setForm] = useState({ category: "other", expense_type: "daily", description: "", amount: "", expense_date: now.toISOString().split("T")[0] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.month) params.append("month", filter.month);
      if (filter.year) params.append("year", filter.year);
      if (filter.type) params.append("type", filter.type);
      const res = await API.get(`/admin/expenses?${params}`);
      setExpenses(res.data);
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await API.post("/admin/expenses", form); setForm({ ...form, description: "", amount: "" }); await load(); } catch {}
    setSaving(false);
  };

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <>
      <div className="page-header"><div><h1>Expense Entry</h1><p>Record daily and monthly expenses</p></div></div>
      <div className="page-body">
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">➕ Add Expense</div>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-grid form-grid-3">
              <div className="form-group">
                <label>Expense Type</label>
                <select value={form.expense_type} onChange={e => setForm({ ...form, expense_type: e.target.value })}>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {(form.expense_type === "daily"
                    ? [["stock","Stock Purchase"],["inventory","Inventory"],["other","Other"]]
                    : [["rent","Land/Rent"],["electricity","Electricity Bill"],["internet","Internet Bill"],["salary","Staff Salary"],["other","Other"]]
                  ).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
              </div>
            </div>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label>Description *</label>
                <input required placeholder="e.g. Vegetables stock purchase" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Amount (Rs.) *</label>
                <input required type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner-sm" /> Adding...</> : "➕ Add Expense"}</button></div>
          </form>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <select value={filter.month} onChange={e => setFilter({ ...filter, month: e.target.value })} style={{ width: "auto" }}>
            {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={filter.year} onChange={e => setFilter({ ...filter, year: e.target.value })} style={{ width: "auto" }}>
            {[now.getFullYear(), now.getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })} style={{ width: "auto" }}>
            <option value="">All Types</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        {loading ? <div className="flex-center" style={{ padding: 40 }}><div className="spinner" /></div> : (
          <>
            {expenses.length > 0 && (
              <div style={{ padding: "12px 16px", marginBottom: 12, background: "var(--danger-bg)", borderRadius: 10, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>{expenses.length} expenses</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: "var(--danger)" }}>Total: Rs. {total.toLocaleString()}</span>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id}>
                      <td style={{ color: "var(--text-muted)" }}>{new Date(e.expense_date).toLocaleDateString()}</td>
                      <td><span className={`badge ${e.expense_type === "daily" ? "badge-pending" : "badge-preparing"}`}>{e.expense_type}</span></td>
                      <td style={{ textTransform: "capitalize" }}>{e.category}</td>
                      <td>{e.description}</td>
                      <td style={{ fontWeight: 700, color: "var(--danger)" }}>Rs. {Number(e.amount).toLocaleString()}</td>
                      <td><button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={async () => { await API.delete(`/admin/expenses/${e.id}`); load(); }}>🗑️</button></td>
                    </tr>
                  ))}
                  {expenses.length === 0 && <tr><td colSpan="6"><div className="empty-state" style={{ padding: 40 }}><div className="empty-icon">💸</div><h3>No expenses recorded</h3></div></td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────
function AttendanceTab() {
  const now = new Date();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(now.toISOString().split("T")[0]);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await API.get(`/admin/attendance?date=${date}`); setRecords(res.data); } catch {}
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  function duration(login, logout) {
    if (!logout) return <span className="animate-pulse" style={{ color: "var(--success)" }}>● Online</span>;
    const mins = Math.round((new Date(logout) - new Date(login)) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Staff Attendance</h1><p>Login/logout records by date</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "auto" }} />
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>
      <div className="page-body">
        {loading ? <div className="flex-center" style={{ padding: 60 }}><div className="spinner" /></div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Staff Name</th><th>Username</th><th>Role</th><th>Login</th><th>Logout</th><th>Duration</th><th>MAC</th></tr></thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{r.username}</td>
                    <td><span className={`badge badge-${r.role}`}>{r.role}</span></td>
                    <td>{new Date(r.login_time).toLocaleTimeString()}</td>
                    <td>{r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : "—"}</td>
                    <td style={{ fontWeight: 600 }}>{duration(r.login_time, r.logout_time)}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.mac_address || r.last_mac || "—"}</td>
                  </tr>
                ))}
                {records.length === 0 && <tr><td colSpan="7"><div className="empty-state" style={{ padding: 40 }}><div className="empty-icon">📋</div><h3>No attendance records</h3></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [itemsCache, setItemsCache] = useState({});
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try { const res = await API.get("/admin/orders"); setOrders(res.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (orderId) => {
    if (expanded === orderId) { setExpanded(null); return; }
    setExpanded(orderId);
    if (!itemsCache[orderId]) {
      try {
        const order = orders.find(o => o.id === orderId);
        // For paid/closed orders use the bill endpoint which merges ALL rounds
        if (order && (order.status === "paid" || order.status === "credit_pending")) {
          const res = await API.get(`/orders/${orderId}/bill`);
          setItemsCache(c => ({ ...c, [orderId]: { items: res.data.items || [], bill: res.data } }));
        } else {
          const res = await API.get(`/orders/${orderId}`);
          setItemsCache(c => ({ ...c, [orderId]: { items: res.data.items || [], bill: null } }));
        }
      } catch {}
    }
  };

  const statusOptions = ["all", "draft", "pending", "preparing", "served", "credit_pending", "paid", "closed"];
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div><h1>All Orders</h1><p>{orders.length} total orders</p></div>
        <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
      </div>
      <div className="page-body">
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {statusOptions.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-secondary"}`}
              style={{ textTransform: "capitalize" }}>
              {s === "all" ? `All (${orders.length})` : `${s} (${orders.filter(o => o.status === s).length})`}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#ID</th><th>Type</th><th>Table</th><th>Waiter</th><th>Status</th><th>Payment</th><th>Total</th><th>Time</th><th></th></tr></thead>
            <tbody>
              {filtered.map(o => (
                <React.Fragment key={o.id}>
                  <tr onClick={() => toggleExpand(o.id)} style={{ cursor: "pointer", background: expanded === o.id ? "var(--bg-surface)" : "" }}>
                    <td style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>#{o.id}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: o.order_type === "takeaway" ? "#fef9c3" : "var(--bg-surface)",
                        color: o.order_type === "takeaway" ? "#b45309" : "var(--text-muted)",
                      }}>
                        {o.order_type === "takeaway" ? "📦 TKW" : "🪑 TBL"}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{o.table_number}</td>
                    <td>{o.waiter_name || "—"}</td>
                    <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                    <td style={{ textTransform: "capitalize" }}>{o.payment_method || "—"}</td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>Rs. {Number(o.total).toLocaleString()}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{new Date(o.created_at).toLocaleString()}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => { if(window.confirm("Delete?")) API.delete(`/admin/orders/${o.id}`).then(load); }}>🗑️</button>
                    </td>
                  </tr>
                  {expanded === o.id && (
                    <tr style={{ background: "var(--bg-surface)" }}>
                      <td colSpan="9" style={{ padding: "0 16px 16px" }}>
                        <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                          {itemsCache[o.id] ? (() => {
                            const { items, bill } = itemsCache[o.id];
                            return (
                              <>
                                {items.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "4px 12px" }}>No items found.</div>}
                                {items.map((item, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 12px", background: "var(--bg-base)", borderRadius: 8, marginBottom: 4 }}>
                                    <span>{item.name || item.item} <span style={{ color: "var(--text-muted)" }}>×{item.quantity}</span></span>
                                    <span style={{ fontWeight: 600 }}>Rs. {Number(item.price).toLocaleString()}</span>
                                  </div>
                                ))}
                                {bill && (
                                  <div style={{ marginTop: 10, borderTop: "1px dashed var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                      Subtotal: <strong>Rs. {Number(bill.subtotal).toLocaleString()}</strong>
                                    </div>
                                    {bill.tax_enabled && bill.tax > 0 && (
                                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                        VAT ({bill.tax_rate}%): <strong>Rs. {Number(bill.tax).toLocaleString()}</strong>
                                      </div>
                                    )}
                                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--success)" }}>
                                      Grand Total: Rs. {Number(bill.total).toLocaleString()}
                                    </div>
                                    {bill.allOrderIds?.length > 1 && (
                                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                        {bill.allOrderIds.length} rounds merged
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })() : <div className="spinner" style={{ width: 18, height: 18 }} />}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && <tr><td colSpan="9"><div className="empty-state" style={{ padding: 40 }}><div className="empty-icon">🧾</div><h3>No orders</h3></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLES — with reservation support
// ─────────────────────────────────────────────────────────────────────────────
function TablesTab() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ table_number: "", capacity: 4 });
  const [saving, setSaving] = useState(false);
  const [editModal, setEditModal] = useState(null);

  const load = useCallback(async () => {
    try { const res = await API.get("/tables"); setTables(res.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await API.post("/tables", form); setForm({ table_number: "", capacity: 4 }); await load(); } catch {}
    setSaving(false);
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        table_number: editModal.table_number,
        capacity: editModal.capacity,
        status: editModal.status,
      };
      if (editModal.status === "reserved") {
        payload.reserved_by_name = editModal.reserved_by_name || "";
        payload.reserved_by_phone = editModal.reserved_by_phone || "";
      }
      await API.put(`/tables/${editModal.id}`, payload);
      setEditModal(null); await load();
    } catch {}
    setSaving(false);
  };

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header"><div><h1>Tables</h1><p>{tables.length} tables configured</p></div></div>
      <div className="page-body">
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">➕ Add Table</div>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Table Number</label>
              <input required type="number" min="1" placeholder="e.g. 7" value={form.table_number} onChange={e => setForm({ ...form, table_number: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Capacity</label>
              <input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner-sm" /> : "Add Table"}</button>
          </form>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px,1fr))", gap: 14 }}>
          {tables.map(t => (
            <div key={t.id} className={`table-tile ${t.status}`} style={{ position: "relative" }}>
              <div className="tile-num">#{t.table_number}</div>
              <div className="tile-status">{t.status}</div>
              {t.status === "reserved" && (
                <div style={{ fontSize: 10, marginTop: 3, color: "var(--accent-light)", fontWeight: 600 }}>
                  📋 {t.reserved_by_name}
                  {t.reserved_by_phone && <div>📞 {t.reserved_by_phone}</div>}
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>👥 {t.capacity} seats</div>
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                <button onClick={() => setEditModal({ ...t })} style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 6, padding: "3px 0", cursor: "pointer", fontSize: 12 }}>✏️</button>
                <button onClick={() => { if(window.confirm("Delete?")) API.delete(`/tables/${t.id}`).then(load); }} style={{ flex: 1, background: "var(--danger-bg)", border: "none", color: "var(--danger)", borderRadius: 6, padding: "3px 0", cursor: "pointer", fontSize: 12 }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Table #{editModal.table_number}</h3>
              <button className="modal-close" onClick={() => setEditModal(null)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label>Table Number</label>
                    <input required type="number" min="1" value={editModal.table_number} onChange={e => setEditModal({ ...editModal, table_number: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Capacity</label>
                    <input required type="number" min="1" value={editModal.capacity} onChange={e => setEditModal({ ...editModal, capacity: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={editModal.status} onChange={e => setEditModal({ ...editModal, status: e.target.value })}>
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
                {editModal.status === "reserved" && (
                  <div className="form-grid form-grid-2">
                    <div className="form-group">
                      <label>Reserved By (Name) *</label>
                      <input placeholder="Customer name" value={editModal.reserved_by_name || ""} onChange={e => setEditModal({ ...editModal, reserved_by_name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Contact Number *</label>
                      <input placeholder="Phone number" value={editModal.reserved_by_phone || ""} onChange={e => setEditModal({ ...editModal, reserved_by_phone: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner-sm" /> Saving...</> : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU
// ─────────────────────────────────────────────────────────────────────────────
function MenuTab() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", category: "food", subcategory: "", description: "", is_available: true });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});

  const load = useCallback(async () => {
    try { const res = await API.get("/menu"); setMenu(res.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: "", price: "", category: "food", subcategory: "", description: "", is_available: true });
    setShowModal(true);
  };
  const openEdit = (item) => { setEditItem(item); setForm({ ...item }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editItem) await API.put(`/menu/${editItem.id}`, form);
      else await API.post("/menu", form);
      setShowModal(false); await load();
    } catch {}
    setSaving(false);
  };

  // ✅ CSV UPLOAD with result feedback
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    import("papaparse").then(({ default: Papa }) => {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: async function (results) {
          try {
            const formatted = results.data.map((row) => ({
              name: (row.name || "").trim(),
              price: Number(row.price) || 0,
              category: (row.category || "food").trim().toLowerCase(),
              subcategory: (row.subcategory || "").trim(),
              description: (row.description || "").trim(),
              is_available: true,
            })).filter(r => r.name);
            await API.post("/menu/bulk", formatted);
            setUploadResult({ success: true, count: formatted.length });
            await load();
          } catch (err) {
            setUploadResult({ success: false, error: "Upload failed. Check your CSV format." });
          }
          setUploading(false);
        },
      });
    });
    e.target.value = "";
  };

  // ✅ Download CSV template
  const downloadTemplate = () => {
    const rows = [
      "name,price,category,subcategory,description",
      "Chicken Mo:Mo,220,food,Mo:Mo,Steamed chicken dumplings",
      "Veg Mo:Mo,180,food,Mo:Mo,Steamed vegetable dumplings",
      "Buff Mo:Mo,200,food,Mo:Mo,Steamed buffalo dumplings",
      "Coke,80,drink,Soft Drinks,Chilled Coca-Cola",
      "Sprite,80,drink,Soft Drinks,Chilled Sprite",
      "Fanta,80,drink,Soft Drinks,Chilled Fanta",
      "Barasinghe,350,drink,Beer,Barasinghe premium beer",
      "Tuborg,400,drink,Beer,Tuborg beer",
      "Chocolate Cake,250,dessert,Cakes,Rich chocolate cake slice",
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "menu-template.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ✅ Dynamic grouping: category → subcategory → items
  const allCategories = [...new Set(menu.map(m => m.category))].sort();
  const catIcons = { food: "🍛", drink: "🥤", dessert: "🍰", snack: "🍿", beverage: "🥤", default: "🍽️" };
  const getCatIcon = (cat) => catIcons[cat?.toLowerCase()] || catIcons.default;

  const grouped = allCategories.map(cat => {
    const catItems = menu.filter(m => m.category === cat);
    const subMap = {};
    catItems.forEach(item => {
      const key = (item.subcategory || "").trim() || "Others";
      if (!subMap[key]) subMap[key] = [];
      subMap[key].push(item);
    });
    return { cat, subMap, total: catItems.length };
  });

  const toggleCat = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div><h1>Menu</h1><p>{menu.length} items · {allCategories.length} categories</p></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Download Template */}
          <button className="btn btn-secondary" onClick={downloadTemplate} title="Download CSV template with sample data">
            📥 CSV Template
          </button>
          {/* Upload CSV */}
          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
            {uploading ? "⏳ Uploading..." : "📁 Upload CSV"}
            <input type="file" accept=".csv" hidden onChange={handleCSVUpload} disabled={uploading} />
          </label>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>
        </div>
      </div>

      <div className="page-body">
        {/* Upload result banner */}
        {uploadResult && (
          <div className={`alert ${uploadResult.success ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
            {uploadResult.success
              ? `✅ Successfully imported ${uploadResult.count} menu items!`
              : `❌ ${uploadResult.error}`}
            <button onClick={() => setUploadResult(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* CSV format guide */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>📋 CSV Format Guide</div>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", background: "var(--bg-base)", padding: "8px 12px", borderRadius: 8 }}>
            name, price, category, subcategory, description
          </div>
          <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12 }}>
            Example categories: <strong>food</strong>, <strong>drink</strong>, <strong>dessert</strong>, <strong>snack</strong> &nbsp;|&nbsp;
            Example subcategories: <strong>Mo:Mo</strong>, <strong>Soft Drinks</strong>, <strong>Beer</strong>, <strong>Cakes</strong>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
            💡 Click <strong>📥 CSV Template</strong> to download a ready-to-fill template with examples.
          </div>
        </div>

        {/* Grouped menu display: Category → Subcategory → Items */}
        {grouped.map(({ cat, subMap, total }) => {
          if (!Object.keys(subMap).length) return null;
          const isExpanded = expandedCats[cat] !== false; // default expanded

          return (
            <div key={cat} style={{ marginBottom: 24 }}>
              {/* Category header */}
              <div
                onClick={() => toggleCat(cat)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                  padding: "12px 16px", borderRadius: 12,
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  marginBottom: isExpanded ? 12 : 0, userSelect: "none",
                }}
              >
                <span style={{ fontSize: 22 }}>{getCatIcon(cat)}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, textTransform: "capitalize" }}>{cat}</span>
                  <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-muted)" }}>
                    {total} items · {Object.keys(subMap).length} subcategories
                  </span>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: 14, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
              </div>

              {isExpanded && (
                <div style={{ paddingLeft: 8 }}>
                  {Object.entries(subMap).map(([sub, items]) => (
                    <div key={sub} style={{ marginBottom: 16 }}>
                      {/* Subcategory header */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 14px", marginBottom: 8,
                        background: "var(--accent-bg,rgba(99,102,241,0.06))",
                        border: "1px solid var(--accent,#6366f1)30",
                        borderRadius: 10, borderLeft: "3px solid var(--accent,#6366f1)",
                      }}>
                        <span style={{ fontSize: 14 }}>📂</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--accent,#6366f1)" }}>{sub}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({items.length} items)</span>
                      </div>

                      <div className="table-wrap" style={{ marginLeft: 12 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Price</th>
                              <th>Description</th>
                              <th>Available</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(item => (
                              <tr key={item.id}>
                                <td style={{ fontWeight: 600 }}>{item.name}</td>
                                <td style={{ color: "var(--success)", fontWeight: 700 }}>
                                  Rs. {Number(item.price).toLocaleString()}
                                </td>
                                <td style={{ color: "var(--text-muted)" }}>{item.description || "—"}</td>
                                <td>
                                  <span className={`badge ${item.is_available ? "badge-active" : "badge-inactive"}`}>
                                    {item.is_available ? "Yes" : "No"}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>✏️</button>
                                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                                      onClick={() => { if (window.confirm("Delete?")) API.delete(`/menu/${item.id}`).then(load); }}>🗑️</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {menu.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🍔</div>
            <h3>No menu items yet</h3>
            <p>Add items manually or upload a CSV file.</p>
          </div>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? "✏️ Edit Item" : "➕ Add Menu Item"}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Name *</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chicken Mo:Mo" />
                </div>
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label>Price (Rs.) *</label>
                    <input type="number" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {[...new Set(["food","drink","dessert","snack",...menu.map(m=>m.category)])].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Subcategory</label>
                    <input
                      value={form.subcategory}
                      onChange={e => setForm({ ...form, subcategory: e.target.value })}
                      placeholder="e.g. Mo:Mo, Soft Drinks, Beer, Cakes…"
                      list="subcats-list"
                    />
                    <datalist id="subcats-list">
                      {[...new Set(menu.filter(m => m.category === form.category).map(m => m.subcategory).filter(Boolean))].map(s => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      Items with the same subcategory are grouped together in the menu.
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" rows={3} />
                </div>
                <div className="form-group">
                  <label>Available</label>
                  <select value={String(form.is_available)} onChange={e => setForm({ ...form, is_available: e.target.value === "true" })}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner-sm" /> Saving…</> : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function InventoryTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ item_name: "", quantity: "", unit: "pcs", min_stock: 10, cost_per_unit: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const res = await API.get("/inventory"); setItems(res.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editItem) await API.put(`/inventory/${editItem.id}`, form);
      else await API.post("/inventory", form);
      setShowModal(false); await load();
    } catch {}
    setSaving(false);
  };

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;
  const lowStock = items.filter(i => i.quantity <= i.min_stock);

  return (
    <>
      <div className="page-header"><div><h1>Inventory</h1><p>{items.length} items · {lowStock.length} low stock</p></div><button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ item_name: "", quantity: "", unit: "pcs", min_stock: 10, cost_per_unit: "" }); setShowModal(true); }}>+ Add Item</button></div>
      <div className="page-body">
        {lowStock.length > 0 && <div className="alert alert-warning" style={{ marginBottom: 16 }}>⚠️ {lowStock.length} item(s) at/below min stock: {lowStock.map(i => i.item_name).join(", ")}</div>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Min Stock</th><th>Cost/Unit</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map(item => {
                const isLow = item.quantity <= item.min_stock;
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                    <td style={{ color: isLow ? "var(--danger)" : "var(--text-primary)", fontWeight: isLow ? 700 : 400 }}>{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td style={{ color: "var(--text-muted)" }}>{item.min_stock}</td>
                    <td>Rs. {Number(item.cost_per_unit || 0).toLocaleString()}</td>
                    <td><span className={`badge ${isLow ? "badge-inactive" : "badge-active"}`}>{isLow ? "Low Stock" : "OK"}</span></td>
                    <td><div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditItem(item); setForm({ ...item }); setShowModal(true); }}>✏️</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => { if(window.confirm("Delete?")) API.delete(`/inventory/${item.id}`).then(load); }}>🗑️</button>
                    </div></td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan="7"><div className="empty-state" style={{ padding: 40 }}><div className="empty-icon">📦</div><h3>No inventory items</h3></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editItem ? "✏️ Edit Item" : "➕ Add Inventory Item"}</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group"><label>Item Name *</label><input required value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} /></div>
                <div className="form-grid form-grid-2">
                  <div className="form-group"><label>Quantity</label><input type="number" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
                  <div className="form-group"><label>Unit</label><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs, kg, L..." /></div>
                  <div className="form-group"><label>Min Stock</label><input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} /></div>
                  <div className="form-group"><label>Cost per Unit (Rs.)</label><input type="number" step="0.01" value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: e.target.value })} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner-sm" /> Saving...</> : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS / STAFF — with contact number and edit feature
// ─────────────────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", role: "waiter", contact_number: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { const res = await API.get("/admin/users"); setUsers(res.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditUser(null);
    setForm({ name: "", username: "", email: "", password: "", role: "waiter", contact_number: "" });
    setError(""); setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ name: u.name, username: u.username, email: u.email || "", password: "", role: u.role, contact_number: u.contact_number || "", is_active: u.is_active });
    setError(""); setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      if (editUser) {
        await API.put(`/admin/users/${editUser.id}`, form);
      } else {
        await API.post("/admin/users", form);
      }
      setShowModal(false);
      setForm({ name: "", username: "", email: "", password: "", role: "waiter", contact_number: "" });
      await load();
    } catch (err) { setError(err.response?.data?.msg || "Failed"); }
    setSaving(false);
  };

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div><h1>Staff Management</h1><p>{users.length} staff members</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Staff</button>
      </div>
      <div className="page-body">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Contact</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{u.username}</td>
                  <td style={{ color: "var(--text-muted)" }}>{u.contact_number || "—"}</td>
                  <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                  <td><span className={`badge badge-${u.is_active ? "active" : "inactive"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>✏️</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => { if(window.confirm("Delete?")) API.delete(`/admin/users/${u.id}`).then(load); }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan="7"><div className="empty-state" style={{ padding: 40 }}><div className="empty-icon">👥</div><h3>No staff yet</h3></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editUser ? "✏️ Edit Staff Member" : "➕ Add Staff Member"}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">⚠️ {error}</div>}
                <div className="form-group"><label>Full Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="form-grid form-grid-2">
                  <div className="form-group"><label>Username *</label><input required placeholder="Login username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
                  <div className="form-group">
                    <label>{editUser ? "New Password" : "Password *"}</label>
                    <input type="password" required={!editUser} placeholder={editUser ? "Leave blank to keep current" : ""} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                  </div>
                </div>
                <div className="form-grid form-grid-2">
                  <div className="form-group"><label>Email</label><input type="email" placeholder="Optional" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="form-group"><label>Contact Number</label><input type="tel" placeholder="Phone number" value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} /></div>
                </div>
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label>Role *</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="waiter">Waiter</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="cashcounter">Cash Counter</option>
                    </select>
                  </div>
                  {editUser && (
                    <div className="form-group">
                      <label>Status</label>
                      <select value={String(form.is_active)} onChange={e => setForm({ ...form, is_active: e.target.value === "true" })}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner-sm" /> Saving...</> : editUser ? "Save Changes" : "Add Staff"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREDITS TAB
// ─────────────────────────────────────────────────────────────────────────────
function CreditsTab() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = React.useCallback(async () => {
    try { const res = await API.get("/credits"); setCredits(res.data); } catch {}
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleReceived = async (id) => {
    try { await API.put(`/credits/${id}/received`); await load(); } catch {}
  };

  const now = new Date();
  const filtered = filter === "all" ? credits
    : filter === "overdue" ? credits.filter(c => c.status === "pending" && new Date(c.deadline) < now)
    : credits.filter(c => c.status === filter);

  const totalPending = credits.filter(c => c.status === "pending").reduce((s, c) => s + parseFloat(c.amount), 0);
  const overdueCount = credits.filter(c => c.status === "pending" && new Date(c.deadline) < now).length;

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div><h1>Credit Payments</h1><p>Pay-later records — confirm received to add to total sales</p></div>
      </div>
      <div className="page-body">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "var(--warning-bg)", fontSize: 20 }}>💳</div>
            <div className="stat-label">Total Pending</div>
            <div className="stat-value warning">Rs. {totalPending.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "var(--danger-bg)", fontSize: 20 }}>🔴</div>
            <div className="stat-label">Overdue</div>
            <div className="stat-value danger">{overdueCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "var(--success-bg)", fontSize: 20 }}>✅</div>
            <div className="stat-label">Collected</div>
            <div className="stat-value success">{credits.filter(c => c.status === "received").length}</div>
          </div>
        </div>

        {overdueCount > 0 && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            ⚠️ {overdueCount} credit payment{overdueCount > 1 ? "s are" : " is"} overdue!
          </div>
        )}

        <div style={{ background: "var(--info-bg,#eff6ff)", border: "1px solid #93c5fd", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1d4ed8" }}>
          💡 Credit payments are <strong>not counted in total sales</strong> until you click "Mark Received".
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {["all","pending","overdue","received"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`}
              style={{ textTransform: "capitalize" }}>
              {f} ({f === "all" ? credits.length : f === "overdue" ? overdueCount : credits.filter(c => c.status === f).length})
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(c => {
            const isOverdue = c.status === "pending" && new Date(c.deadline) < now;
            const daysLeft = Math.ceil((new Date(c.deadline) - now) / 86400000);
            return (
              <div key={c.id} className={`credit-card ${isOverdue ? "overdue" : c.status}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{c.customer_name}</span>
                      <span className={`badge badge-${c.status === "received" ? "paid" : isOverdue ? "inactive" : "credit"}`}>
                        {isOverdue ? "OVERDUE" : c.status.toUpperCase()}
                      </span>
                      {c.table_number && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Table {c.table_number}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-muted)" }}>
                      <span>📞 {c.customer_phone}</span>
                      <span>📅 Due: <strong style={{ color: isOverdue ? "var(--danger)" : "var(--text-primary)" }}>{new Date(c.deadline).toLocaleDateString()}</strong>
                        {c.status === "pending" && !isOverdue && <span style={{ color: "var(--warning)", marginLeft: 4 }}>({daysLeft}d left)</span>}
                        {isOverdue && <span style={{ color: "var(--danger)", marginLeft: 4 }}>({Math.abs(daysLeft)}d overdue)</span>}
                      </span>
                    </div>
                    {c.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>📝 {c.notes}</div>}
                    {c.received_at && <div style={{ fontSize: 12, color: "var(--success)", marginTop: 4 }}>✅ Received: {new Date(c.received_at).toLocaleDateString()} — Added to sales</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: isOverdue ? "var(--danger)" : c.status === "received" ? "var(--success)" : "var(--warning)" }}>
                      Rs. {Number(c.amount).toLocaleString()}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                      {c.status === "pending" && (
                        <button className="btn btn-success btn-sm" onClick={() => handleReceived(c.id)}>
                          ✓ Mark Received
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => { if(window.confirm("Delete?")) API.delete(`/credits/${c.id}`).then(load); }}>🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">💳</div><h3>No credit records</h3></div>}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY SPECIALS TAB
// ─────────────────────────────────────────────────────────────────────────────
function DailySpecialsTab() {
  const [specials, setSpecials] = useState([]);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ menu_id: "", discount_pct: 0, label: "", active_date: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);

  const load = React.useCallback(async () => {
    try {
      const [s, m] = await Promise.all([API.get("/extras/specials"), API.get("/menu")]);
      setSpecials(s.data); setMenu(m.data.filter(i => i.is_available));
    } catch {}
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await API.post("/extras/specials", form); await load(); setForm({ menu_id: "", discount_pct: 0, label: "", active_date: new Date().toISOString().split("T")[0] }); } catch {}
    setSaving(false);
  };

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header"><div><h1>Daily Specials</h1><p>Highlighted items appear with discounted price in waiter's menu</p></div></div>
      <div className="page-body">
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">⭐ Add Special</div>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label>Menu Item *</label>
                <select required value={form.menu_id} onChange={e => setForm({ ...form, menu_id: e.target.value })}>
                  <option value="">-- Select item --</option>
                  {menu.map(m => <option key={m.id} value={m.id}>{m.name} (Rs. {m.price})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Discount %</label>
                <input type="number" min="0" max="100" value={form.discount_pct} onChange={e => setForm({ ...form, discount_pct: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Label (e.g. "Chef's Choice")</label>
                <input placeholder="Optional display label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={form.active_date} onChange={e => setForm({ ...form, active_date: e.target.value })} />
              </div>
            </div>
            {form.menu_id && form.discount_pct > 0 && (
              <div style={{ background: "var(--success-bg)", border: "1px solid var(--success)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--success)" }}>
                💡 Waiter will see this item at <strong>Rs. {Math.round(menu.find(m => String(m.id) === String(form.menu_id))?.price * (1 - form.discount_pct/100) || 0).toLocaleString()}</strong> with <strong>{form.discount_pct}% off</strong> label.
              </div>
            )}
            <div><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner-sm" /> Adding...</> : "⭐ Add Special"}</button></div>
          </form>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
          {specials.map(s => (
            <div key={s.id} className="card" style={{ border: "1px solid var(--warning-bg)", position: "relative" }}>
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", padding: "3px 6px" }} onClick={async () => { await API.delete(`/extras/specials/${s.id}`); load(); }}>✕</button>
              </div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⭐</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
              {s.label && <div style={{ fontSize: 12, color: "var(--warning)", fontStyle: "italic", marginTop: 3 }}>"{s.label}"</div>}
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "var(--success)" }}>
                  Rs. {s.discount_pct > 0 ? Math.round(s.price * (1 - s.discount_pct / 100)).toLocaleString() : Number(s.price).toLocaleString()}
                </span>
                {s.discount_pct > 0 && (
                  <>
                    <span style={{ textDecoration: "line-through", fontSize: 12, color: "var(--text-muted)" }}>Rs. {Number(s.price).toLocaleString()}</span>
                    <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{s.discount_pct}% off</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>📱 Visible to waiter at discounted price</div>
            </div>
          ))}
          {specials.length === 0 && <div className="empty-state" style={{ gridColumn: "1/-1", padding: 40 }}><div className="empty-icon">⭐</div><h3>No specials today</h3></div>}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WASTE LOG TAB
// ─────────────────────────────────────────────────────────────────────────────
function WasteLogTab() {
  const now = new Date();
  const [waste, setWaste] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ item_name: "", quantity: "", unit: "pcs", reason: "", estimated_cost: "", logged_at: now.toISOString().split("T")[0] });
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const load = React.useCallback(async () => {
    setLoading(true);
    try { const res = await API.get(`/extras/waste?month=${month}&year=${year}`); setWaste(res.data); } catch {}
    setLoading(false);
  }, [month, year]);

  React.useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await API.post("/extras/waste", form); setForm({ item_name: "", quantity: "", unit: "pcs", reason: "", estimated_cost: "", logged_at: now.toISOString().split("T")[0] }); await load(); } catch {}
    setSaving(false);
  };

  const totalCost = waste.reduce((s, w) => s + parseFloat(w.estimated_cost || 0), 0);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const reasons = ["Expired","Overcooked","Dropped/Spilled","Quality issue","Customer return","Other"];

  return (
    <>
      <div className="page-header"><div><h1>Waste Log</h1><p>Track food waste to reduce costs</p></div></div>
      <div className="page-body">
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">📝 Log Waste</div>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div className="form-grid form-grid-3">
              <div className="form-group"><label>Item Name *</label><input required value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} placeholder="e.g. Rice, Chicken" /></div>
              <div className="form-group"><label>Quantity *</label><input required type="number" step="0.01" min="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
              <div className="form-group"><label>Unit</label><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs, kg, L..." /></div>
              <div className="form-group"><label>Reason</label><select value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}><option value="">Select reason</option>{reasons.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
              <div className="form-group"><label>Est. Cost (Rs.)</label><input type="number" min="0" step="0.01" value={form.estimated_cost} onChange={e => setForm({ ...form, estimated_cost: e.target.value })} /></div>
              <div className="form-group"><label>Date</label><input type="date" value={form.logged_at} onChange={e => setForm({ ...form, logged_at: e.target.value })} /></div>
            </div>
            <div><button type="submit" className="btn btn-warning" disabled={saving}>{saving ? <><span className="spinner-sm" /> Logging...</> : "🗑️ Log Waste"}</button></div>
          </form>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: "auto" }}>{months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}</select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: "auto" }}>{[now.getFullYear(), now.getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}</select>
          {waste.length > 0 && <span style={{ marginLeft: "auto", fontWeight: 700, color: "var(--danger)" }}>Total: Rs. {totalCost.toLocaleString()}</span>}
        </div>
        {loading ? <div className="flex-center" style={{ padding: 40 }}><div className="spinner" /></div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Item</th><th>Quantity</th><th>Reason</th><th>Est. Cost</th><th></th></tr></thead>
              <tbody>
                {waste.map(w => (
                  <tr key={w.id}>
                    <td style={{ color: "var(--text-muted)" }}>{new Date(w.logged_at).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600 }}>{w.item_name}</td>
                    <td>{w.quantity} {w.unit}</td>
                    <td style={{ color: "var(--text-muted)" }}>{w.reason || "—"}</td>
                    <td style={{ fontWeight: 700, color: "var(--danger)" }}>Rs. {Number(w.estimated_cost || 0).toLocaleString()}</td>
                    <td><button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={async () => { await API.delete(`/extras/waste/${w.id}`); load(); }}>🗑️</button></td>
                  </tr>
                ))}
                {waste.length === 0 && <tr><td colSpan="6"><div className="empty-state" style={{ padding: 40 }}><div className="empty-icon">🗑️</div><h3>No waste logged</h3></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART INSIGHTS TAB — FIXED: no async in useEffect
// ─────────────────────────────────────────────────────────────────────────────
function InsightsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchInsights = React.useCallback(async () => {
    setLoading(true); setError(false);
    try { const res = await API.get("/extras/insights"); setData(res.data); }
    catch { setError(true); }
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const peakHourLabel = (h) => {
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:00 ${ampm}`;
  };

  if (loading) return <div className="page-body flex-center"><div className="spinner" /></div>;
  if (error || !data) return (
    <div className="page-body">
      <div className="alert alert-error">
        ⚠️ Failed to load insights. Make sure you have orders and data recorded.
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }} onClick={fetchInsights}>↻ Retry</button>
      </div>
    </div>
  );

  // — Compute actionable decisions —
  const decisions = [];

  // Profit-losing items (slow movers)
  if (data.slow_items?.length > 0) {
    const top3slow = data.slow_items.slice(0, 3);
    decisions.push({
      urgency: "high", icon: "🗑️", color: "var(--danger)", bg: "var(--danger-bg)",
      title: `${data.slow_items.length} menu items have ZERO orders this month`,
      decision: `Remove or discount: ${top3slow.map(i => i.name).join(", ")}`,
      action: "Go to Daily Specials → set 20% discount on these items for 3 days and watch if orders pick up. If still zero after a week, remove from menu to reduce ingredient waste.",
    });
  }

  // Price increase opportunity on top sellers
  if (data.top_items?.length > 0) {
    const topItem = data.top_items[0];
    const potentialIncrease = Math.round(Number(topItem.revenue) * 0.05);
    decisions.push({
      urgency: "medium", icon: "💰", color: "var(--success)", bg: "var(--success-bg)",
      title: `"${topItem.name}" is your #1 seller — high demand, price-inelastic`,
      decision: `Increase price of "${topItem.name}" by 5–8% (customers will still order it)`,
      action: `A 5% price increase = Rs. ${potentialIncrease.toLocaleString()} extra revenue/month with no extra work. Go to Menu → edit this item's price now.`,
    });
  }

  // Staffing based on peak hours
  if (data.peak_hours?.length > 0) {
    const peak = data.peak_hours[0];
    const offPeak = data.peak_hours[data.peak_hours.length - 1];
    decisions.push({
      urgency: "medium", icon: "⏰", color: "var(--info)", bg: "var(--info-bg)",
      title: `Peak hour: ${peakHourLabel(peak.hour)} (${peak.orders} orders) vs slow: ${peakHourLabel(offPeak.hour)} (${offPeak.orders} orders)`,
      decision: `Schedule extra staff during ${peakHourLabel(peak.hour)} only — avoid overstaffing off-peak`,
      action: `Rotate 1–2 part-time staff to cover ${peakHourLabel(peak.hour)}–${peakHourLabel((peak.hour + 1) % 24)} peak window. This reduces salary cost while maintaining service quality.`,
    });
  }

  // Credit collection urgency
  if (data.credit_pending?.count > 0) {
    const avgCredit = Math.round(Number(data.credit_pending.total) / data.credit_pending.count);
    decisions.push({
      urgency: data.credit_pending.count > 5 ? "high" : "medium",
      icon: "📋", color: "var(--warning)", bg: "var(--warning-bg)",
      title: `Rs. ${Number(data.credit_pending.total).toLocaleString()} in unpaid credit from ${data.credit_pending.count} customers`,
      decision: `Call the ${Math.min(3, data.credit_pending.count)} oldest overdue credit customers today`,
      action: `Average credit amount is Rs. ${avgCredit.toLocaleString()}. Go to Credit Payments → sort by deadline → call overdue ones. Uncollected credit = cash flow problems.`,
    });
  }

  // Waste reduction
  if (Number(data.waste_cost) > 0) {
    decisions.push({
      urgency: "medium", icon: "🗑️", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",
      title: `Rs. ${Number(data.waste_cost).toLocaleString()} wasted this month`,
      decision: "Reduce purchase quantities for ingredients linked to slow-selling items",
      action: "Cross-reference your Waste Log with slow-moving menu items. Buy 30% less of those ingredients this week — if demand increases, restock. Waste = profit leaking out.",
    });
  }

  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  decisions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return (
    <>
      <div className="page-header">
        <div><h1>🧠 Smart Decisions</h1><p>Data-driven actions to grow your restaurant</p></div>
        <button className="btn btn-secondary btn-sm" onClick={fetchInsights}>↻ Refresh</button>
      </div>
      <div className="page-body">

        {/* ACTION DECISIONS — the main focus */}
        {decisions.length > 0 ? (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              🎯 Your {decisions.length} Actions This Week
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>— sorted by urgency</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {decisions.map((d, i) => (
                <div key={i} style={{
                  background: d.bg, border: `1.5px solid ${d.color}40`, borderRadius: 14,
                  padding: "16px 20px", borderLeft: `4px solid ${d.color}`,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${d.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      {d.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                          background: d.urgency === "high" ? "var(--danger)" : d.urgency === "medium" ? "var(--warning)" : "var(--info)",
                          color: "#fff", textTransform: "uppercase", letterSpacing: 0.5,
                        }}>
                          {d.urgency === "high" ? "🔴 Urgent" : d.urgency === "medium" ? "🟡 This Week" : "🟢 When Possible"}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: d.color, marginBottom: 6 }}>{d.title}</div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>👉</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{d.decision}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{d.action}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="alert alert-success" style={{ marginBottom: 24 }}>
            ✅ No urgent actions needed right now. Your restaurant is performing well!
          </div>
        )}

        {/* DATA BEHIND DECISIONS */}
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--text-muted)" }}>📊 Data Behind These Decisions</div>
        <div className="insight-grid">
          <div className="insight-card">
            <div className="insight-title">🏆 Top 3 Sellers — Keep These on Menu</div>
            {data.top_items?.length > 0 ? data.top_items.slice(0, 5).map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "var(--text-muted)", fontWeight: 800, fontSize: 15 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}
                  </span>
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: "var(--success)", fontSize: 13 }}>Rs. {Number(item.revenue).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.qty_sold} sold</div>
                </div>
              </div>
            )) : <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No sales data yet this month</div>}
          </div>

          <div className="insight-card">
            <div className="insight-title">⏰ Peak Hours — Staff Accordingly</div>
            {data.peak_hours?.length > 0 ? data.peak_hours.slice(0, 5).map((h, i) => (
              <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{peakHourLabel(h.hour)}</span>
                  <span style={{ color: "var(--accent-light)", fontWeight: 700 }}>{h.orders} orders</span>
                </div>
                <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(h.orders / data.peak_hours[0].orders) * 100}%`, background: "var(--gradient-brand)", borderRadius: 3 }} />
                </div>
              </div>
            )) : <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No order data yet</div>}
          </div>

          <div className="insight-card" style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
            <div className="insight-title">📉 Dead Weight — 0 Orders This Month</div>
            {data.slow_items?.length > 0 ? (
              <>
                {data.slow_items.map((item, i) => (
                  <div key={i} style={{ padding: "6px 10px", background: "var(--danger-bg)", borderRadius: 6, marginBottom: 6, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{item.name}</span>
                    <span style={{ fontSize: 10, color: "var(--danger)", fontWeight: 700 }}>REMOVE OR DISCOUNT</span>
                  </div>
                ))}
              </>
            ) : <div style={{ color: "var(--success)", fontSize: 13 }}>✅ All menu items are selling!</div>}
          </div>

          <div className="insight-card" style={{ border: "1px solid rgba(245,158,11,0.3)" }}>
            <div className="insight-title">💳 Credit Outstanding</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "var(--warning)", letterSpacing: -1 }}>
              Rs. {Number(data.credit_pending?.total || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{data.credit_pending?.count || 0} unpaid transactions</div>
            {data.credit_pending?.count > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--warning)", fontWeight: 600 }}>
                👉 Call customers → Credits Payments tab
              </div>
            )}
          </div>

          <div className="insight-card" style={{ border: "1px solid rgba(139,92,246,0.25)" }}>
            <div className="insight-title">🗑️ Waste Cost This Month</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#8b5cf6", letterSpacing: -1 }}>
              Rs. {Number(data.waste_cost || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              {Number(data.waste_cost) > 0
                ? "👉 Buy less of slow-moving ingredients next week"
                : "✅ Great! Minimal waste this month."}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}