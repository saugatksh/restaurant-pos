import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../api";

const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "restaurants", label: "Restaurants", icon: "🏪" },
];

export default function SuperAdminDashboard() {
  const [tab, setTab] = useState("overview");
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/superadmin/login"); };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <div className="logo-icon">⚡</div>
            <h2>RestoPOS</h2>
          </div>
          <div className="brand-role">Super Admin</div>
          <div className="restaurant-name">Control Center</div>
        </div>
        <nav>
          {TABS.map(t => (
            <button key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">Super Admin</div>
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
        {tab === "overview" && <SAOverviewTab />}
        {tab === "restaurants" && <SARestaurantsTab />}
      </div>
    </div>
  );
}

function SAOverviewTab() {
  const [stats, setStats] = useState({});
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        API.get("/super-admin/stats"),
        API.get("/super-admin/restaurants"),
      ]);
      setStats(s.data);
      setRestaurants(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="page-body"><div className="spinner" /></div>;

  const expiringSoon = restaurants.filter(r => {
    const days = Math.ceil((new Date(r.subscription_end) - Date.now()) / 86400000);
    return days > 0 && days <= 30 && r.is_active;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Super Admin Overview</h1>
          <p>Global restaurant management</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <StatCard icon="🏪" label="Total Restaurants" value={stats.total_restaurants || 0} color="accent" />
          <StatCard icon="✅" label="Active Subscriptions" value={stats.active_subscriptions || 0} color="success" />
          <StatCard icon="👥" label="Total Users" value={stats.total_users || 0} color="info" />
          <StatCard icon="🔴" label="Inactive / Expired" value={stats.inactive_restaurants || 0} color="danger" />
        </div>

        {expiringSoon.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div className="section-title">⚠️ Subscriptions Expiring Soon</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {expiringSoon.map(r => {
                const days = Math.ceil((new Date(r.subscription_end) - Date.now()) / 86400000);
                return (
                  <div key={r.id} className="alert alert-warning">
                    <strong>{r.name}</strong> — subscription expires in {days} day{days !== 1 ? "s" : ""}
                    ({new Date(r.subscription_end).toLocaleDateString()})
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="section-title">All Restaurants</div>
        <div className="restaurants-grid">
          {restaurants.map(r => <RestaurantMiniCard key={r.id} restaurant={r} />)}
        </div>
      </div>
    </>
  );
}

function RestaurantMiniCard({ restaurant: r }) {
  const days = Math.ceil((new Date(r.subscription_end) - Date.now()) / 86400000);
  const isActive = r.is_active && days > 0;
  const isExpiring = isActive && days <= 30;

  return (
    <div className="restaurant-card">
      <div className="restaurant-card-header">
        <div>
          <div className="restaurant-name-big">{r.name}</div>
          <div className="restaurant-meta">{r.address}</div>
        </div>
        <span className={`sub-badge ${isExpiring ? "sub-expiring" : isActive ? "sub-active" : "sub-expired"}`}>
          {isExpiring ? "⚠️ Expiring" : isActive ? "✅ Active" : "❌ Expired"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
        <span>👥 {r.staff_count} staff</span>
        <span>📅 Until {new Date(r.subscription_end).toLocaleDateString()}</span>
        {!isActive && <span style={{ color: "var(--danger)", fontWeight: 600 }}>Service stopped</span>}
      </div>
    </div>
  );
}

function SARestaurantsTab() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [renewModal, setRenewModal] = useState(null);
  const [usersModal, setUsersModal] = useState(null);
  const [filter, setFilter] = useState("all"); // all | active | inactive
  const [form, setForm] = useState({ name: "", address: "", phone: "", pan_number: "", subscription_start: "", subscription_end: "", logo: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await API.get("/super-admin/restaurants");
      setRestaurants(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await API.post("/super-admin/restaurants", form);
      setShowModal(false);
      setForm({ name: "", address: "", phone: "", pan_number: "", subscription_start: "", subscription_end: "", logo: "" });
      await load();
    } catch (err) { setError(err.response?.data?.error || "Failed to create"); }
    setSaving(false);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await API.put(`/super-admin/restaurants/${editModal.id}`, editModal);
      setEditModal(null);
      await load();
    } catch (err) { setError(err.response?.data?.error || "Failed to update"); }
    setSaving(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete restaurant "${name}" and all its data? This cannot be undone.`)) return;
    try {
      await API.delete(`/super-admin/restaurants/${id}`);
      await load();
    } catch {}
  };

  if (loading) return <div className="page-body"><div className="spinner" /></div>;

  const filtered = restaurants.filter(r => {
    const days = Math.ceil((new Date(r.subscription_end) - Date.now()) / 86400000);
    const isActive = r.is_active && days > 0;
    if (filter === "active") return isActive;
    if (filter === "inactive") return !isActive;
    return true;
  });

  const inactiveCount = restaurants.filter(r => {
    const days = Math.ceil((new Date(r.subscription_end) - Date.now()) / 86400000);
    return !r.is_active || days <= 0;
  }).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Restaurants</h1>
          <p>Manage all restaurants and subscriptions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Restaurant</button>
      </div>
      <div className="page-body">
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[
            { key: "all", label: `All (${restaurants.length})` },
            { key: "active", label: `✅ Active (${restaurants.length - inactiveCount})` },
            { key: "inactive", label: `🔴 Inactive (${inactiveCount})` },
          ].map(f => (
            <button
              key={f.key}
              className={`btn btn-sm ${filter === f.key ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilter(f.key)}
            >{f.label}</button>
          ))}
        </div>

        {/* Inactive alert banner */}
        {inactiveCount > 0 && filter !== "active" && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            ⚠️ <strong>{inactiveCount} restaurant{inactiveCount !== 1 ? "s" : ""}</strong> have inactive subscriptions.
            Their data is preserved — use <strong>🔄 Renew</strong> to restore service.
          </div>
        )}

        <div className="restaurants-grid">
          {filtered.map(r => {
            const days = Math.ceil((new Date(r.subscription_end) - Date.now()) / 86400000);
            const isActive = r.is_active && days > 0;
            const isExpiring = isActive && days <= 30;
            const isInactive = !r.is_active;
            const isExpired = r.is_active && days <= 0;

            return (
              <div key={r.id} className="restaurant-card" style={!isActive ? { opacity: 0.85, borderLeft: "3px solid var(--danger)" } : {}}>
                <div className="restaurant-card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {r.logo
                      ? <img src={r.logo} alt={r.name}
                          style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }} />
                      : <div style={{ width: 42, height: 42, borderRadius: 10, background: isActive ? "var(--gradient-brand)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🍽️</div>
                    }
                    <div>
                      <div className="restaurant-name-big">{r.name}</div>
                      <div className="restaurant-meta">{r.address}</div>
                      {r.phone && <div className="restaurant-meta">📞 {r.phone}</div>}
                      {r.pan_number && <div className="restaurant-meta">🪪 PAN: {r.pan_number}</div>}
                    </div>
                  </div>
                  <span className={`sub-badge ${isExpiring ? "sub-expiring" : isActive ? "sub-active" : "sub-expired"}`}>
                    {isInactive ? "🔴 Inactive" : isExpired ? "❌ Expired" : isExpiring ? `⚠️ ${days}d left` : "✅ Active"}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "12px 0", fontSize: 12, color: "var(--text-muted)" }}>
                  <span>👥 {r.staff_count} staff</span>
                  <span>👔 {r.admin_count} admin(s)</span>
                  <span>📅 {new Date(r.subscription_start).toLocaleDateString()} → {new Date(r.subscription_end).toLocaleDateString()}</span>
                </div>

                {/* Inactive notice with data-preserved message */}
                {!isActive && (
                  <div style={{
                    background: "var(--danger-bg, rgba(239,68,68,0.08))",
                    border: "1px solid var(--danger)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "var(--danger)",
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <span>🔒</span>
                    <span>
                      <strong>Service suspended.</strong> All data (menu, orders, staff, inventory) is preserved.
                      Renew subscription to restore access.
                    </span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setUsersModal(r)}>
                    👥 Staff
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditModal({ ...r })}>
                    ✏️ Edit
                  </button>
                  {/* Renew button — prominent for inactive, subtle for active */}
                  <button
                    className={`btn btn-sm ${!isActive ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setRenewModal(r)}
                    title="Renew subscription"
                  >
                    🔄 Renew
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r.id, r.name)}
                    style={{ marginLeft: "auto", color: "var(--danger)" }}>
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
              No restaurants found.
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Add New Restaurant</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {error && <div className="alert alert-error">⚠️ {error}</div>}
                <div className="form-group">
                  <label>Restaurant Name *</label>
                  <input required placeholder="e.g. The Grand Kitchen" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input placeholder="Full address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input placeholder="+977-..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>PAN Number</label>
                  <input placeholder="e.g. 123456789" value={form.pan_number} onChange={e => setForm({ ...form, pan_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Restaurant Logo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {form.logo && (
                      <img src={form.logo} alt="logo preview"
                        style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }} />
                    )}
                    <input type="file" accept="image/*" style={{ flex: 1 }}
                      onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => setForm(f => ({ ...f, logo: ev.target.result }));
                        reader.readAsDataURL(file);
                      }} />
                    {form.logo && (
                      <button type="button" className="btn btn-ghost btn-sm"
                        style={{ color: "var(--danger)", whiteSpace: "nowrap" }}
                        onClick={() => setForm(f => ({ ...f, logo: "" }))}>✕ Remove</button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Shown in the admin sidebar. Recommended: square image, max 1MB.
                  </div>
                </div>
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label>Subscription Start *</label>
                    <input type="date" required value={form.subscription_start} onChange={e => setForm({ ...form, subscription_start: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Subscription End *</label>
                    <input type="date" required value={form.subscription_end} onChange={e => setForm({ ...form, subscription_end: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner-sm" /> Saving...</> : "Create Restaurant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Restaurant</h3>
              <button className="modal-close" onClick={() => setEditModal(null)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">⚠️ {error}</div>}
                <div className="form-group">
                  <label>Restaurant Name</label>
                  <input value={editModal.name} onChange={e => setEditModal({ ...editModal, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input value={editModal.address || ""} onChange={e => setEditModal({ ...editModal, address: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input value={editModal.phone || ""} onChange={e => setEditModal({ ...editModal, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>PAN Number</label>
                  <input placeholder="e.g. 123456789" value={editModal.pan_number || ""} onChange={e => setEditModal({ ...editModal, pan_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Restaurant Logo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {editModal.logo && (
                      <img src={editModal.logo} alt="logo preview"
                        style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }} />
                    )}
                    <input type="file" accept="image/*" style={{ flex: 1 }}
                      onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => setEditModal(m => ({ ...m, logo: ev.target.result }));
                        reader.readAsDataURL(file);
                      }} />
                    {editModal.logo && (
                      <button type="button" className="btn btn-ghost btn-sm"
                        style={{ color: "var(--danger)", whiteSpace: "nowrap" }}
                        onClick={() => setEditModal(m => ({ ...m, logo: "" }))}>✕ Remove</button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Shown in the admin sidebar after login.
                  </div>
                </div>
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label>Subscription Start</label>
                    <input type="date" value={editModal.subscription_start?.split("T")[0] || ""} onChange={e => setEditModal({ ...editModal, subscription_start: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Subscription End</label>
                    <input type="date" value={editModal.subscription_end?.split("T")[0] || ""} onChange={e => setEditModal({ ...editModal, subscription_end: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={editModal.is_active ? "true" : "false"} onChange={e => setEditModal({ ...editModal, is_active: e.target.value === "true" })}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner-sm" /> Saving...</> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Subscription Modal */}
      {renewModal && (
        <RenewModal
          restaurant={renewModal}
          onClose={() => setRenewModal(null)}
          onRenewed={() => { setRenewModal(null); load(); }}
        />
      )}

      {/* Users Modal */}
      {usersModal && <StaffModal restaurant={usersModal} onClose={() => setUsersModal(null)} />}
    </>
  );
}

// ─── RENEW SUBSCRIPTION MODAL ────────────────────────────────────────────────
function RenewModal({ restaurant, onClose, onRenewed }) {
  const today = new Date().toISOString().split("T")[0];
  // Default: start today, end 1 year from today
  const oneYearLater = new Date();
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const defaultEnd = oneYearLater.toISOString().split("T")[0];

  const [form, setForm] = useState({
    subscription_start: today,
    subscription_end: defaultEnd,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const days = Math.ceil((new Date(restaurant.subscription_end) - Date.now()) / 86400000);
  const wasActive = restaurant.is_active && days > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await API.post(`/super-admin/restaurants/${restaurant.id}/renew`, form);
      setSuccess(true);
      setTimeout(onRenewed, 1200);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to renew subscription");
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>🔄 Renew Subscription</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Restaurant summary */}
          <div style={{
            background: "var(--bg-secondary)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            <div style={{ fontSize: 28 }}>🍽️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{restaurant.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Previous period: {new Date(restaurant.subscription_start).toLocaleDateString()} → {new Date(restaurant.subscription_end).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <span style={{
                  background: wasActive ? "var(--success-bg)" : "var(--danger-bg, rgba(239,68,68,0.12))",
                  color: wasActive ? "var(--success)" : "var(--danger)",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontWeight: 600,
                }}>
                  {wasActive ? "⚠️ Expiring" : "🔴 Currently Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Data preservation notice */}
          <div style={{
            background: "var(--info-bg, rgba(59,130,246,0.08))",
            border: "1px solid var(--info, #3b82f6)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 20,
            display: "flex",
            gap: 10,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>💾</span>
            <span>
              <strong>All data is preserved.</strong> Menu items, orders, staff accounts, inventory,
              and settings will all be immediately accessible once the subscription is renewed.
              Nothing is reset.
            </span>
          </div>

          {success ? (
            <div className="alert alert-success" style={{ textAlign: "center", padding: 20, fontSize: 15 }}>
              ✅ Subscription renewed! Service is now active.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label>New Start Date *</label>
                  <input
                    type="date"
                    required
                    value={form.subscription_start}
                    onChange={e => setForm({ ...form, subscription_start: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>New End Date *</label>
                  <input
                    type="date"
                    required
                    min={form.subscription_start}
                    value={form.subscription_end}
                    onChange={e => setForm({ ...form, subscription_end: e.target.value })}
                  />
                </div>
              </div>
              {form.subscription_start && form.subscription_end && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8, marginBottom: 16 }}>
                  Duration: {Math.ceil((new Date(form.subscription_end) - new Date(form.subscription_start)) / 86400000)} days
                </div>
              )}
              <div className="modal-footer" style={{ padding: 0, paddingTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner-sm" /> Renewing...</> : "🔄 Renew & Activate"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function StaffModal({ restaurant, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", role: "admin" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await API.get(`/super-admin/restaurants/${restaurant.id}/admins`);
      setUsers(res.data);
    } catch {}
    setLoading(false);
  }, [restaurant.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await API.post(`/super-admin/restaurants/${restaurant.id}/admins`, form);
      setForm({ name: "", username: "", email: "", password: "", role: "admin" });
      await load();
    } catch (err) { setError(err.response?.data?.msg || "Failed to create user"); }
    setSaving(false);
  };

  const handleDelete = async (uid) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await API.delete(`/super-admin/restaurants/${restaurant.id}/admins/${uid}`);
      await load();
    } catch {}
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>👥 Staff — {restaurant.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="section-title">Add Staff Account</div>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label>Full Name *</label>
                <input required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Username *</label>
                <input required placeholder="login username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input required type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">Admin</option>
                  <option value="waiter">Waiter</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="cashcounter">Cash Counter</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <><span className="spinner-sm" /> Adding...</> : "Add Staff"}
              </button>
            </div>
          </form>

          <div className="divider" />
          <div className="section-title">Current Staff ({users.length})</div>
          {loading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{u.username}</td>
                      <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                      <td><span className={`badge badge-${u.is_active ? "active" : "inactive"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => handleDelete(u.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>No staff yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `var(--${color === "info" ? "info-bg" : color + "-bg"})` }}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color}`}>{value}</div>
    </div>
  );
}
