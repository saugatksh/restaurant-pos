import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../api";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit" });
}
function timeSince(ts) {
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

// ─── DISCOUNT HELPER ─────────────────────────────────────────────────────────
// Computes the Rs. discount amount and grand total given:
//   totalWithTax : subtotal + VAT  (the "after-tax" base the discount applies to)
//   discountType : "percent" | "fixed"
//   discountValue: the raw number the cashier typed
function computeDiscount(totalWithTax, discountType, discountValue) {
  const val = parseFloat(discountValue) || 0;
  if (val <= 0) return { discountAmt: 0, grandTotal: totalWithTax };

  let discountAmt;
  if (discountType === "percent") {
    // clamp percent to [0, 100]
    const pct = Math.min(100, Math.max(0, val));
    discountAmt = parseFloat((totalWithTax * pct / 100).toFixed(2));
  } else {
    // fixed Rs. amount — clamp so it never exceeds the total
    discountAmt = Math.min(totalWithTax, Math.max(0, parseFloat(val.toFixed(2))));
  }

  const grandTotal = parseFloat((totalWithTax - discountAmt).toFixed(2));
  return { discountAmt, grandTotal };
}

export default function CashCounterPanel() {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billLoading, setBillLoading] = useState(false);
  const [step, setStep] = useState("list");
  const [payMethod, setPayMethod] = useState(null);
  const [paying, setPaying] = useState(false);
  const [creditModal, setCreditModal] = useState(false);
  const [creditForm, setCreditForm] = useState({ customer_name: "", customer_phone: "", deadline: "", notes: "" });
  const [reserveModal, setReserveModal] = useState(null);
  const [reserveForm, setReserveForm] = useState({ reserved_by_name: "", reserved_by_phone: "" });
  const [reserving, setReserving] = useState(false);
  const [takeawayModal, setTakeawayModal] = useState(false);
  const [menu, setMenu] = useState([]);
  const [takeawayItems, setTakeawayItems] = useState([]);
  const [takeawayOrder, setTakeawayOrder] = useState(null);
  const [savingTakeaway, setSavingTakeaway] = useState(false);
  const [finalBill, setFinalBill] = useState(null);
  const [taxSettings, setTaxSettings] = useState(null);

  // ── Discount state ────────────────────────────────────────────────────────
  const [discountType, setDiscountType] = useState("percent"); // "percent" | "fixed"
  const [discountValue, setDiscountValue] = useState("");      // raw input string

  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const loadOrders = useCallback(async () => {
    try {
      const [ordRes, tblRes, taxRes] = await Promise.all([
        API.get("/orders"),
        API.get("/tables"),
        API.get("/extras/tax-settings"),
      ]);
      const allOrders = ordRes.data.filter(o =>
        ["served", "preparing", "pending", "credit_pending"].includes(o.status)
      );
      // Table-assigned takeaways (order_type=takeaway WITH a table_id) are
      // already merged into the table bill — exclude them as standalone entries.
      // Only standalone takeaways (no table_id) get their own card.
      const standaloneOrders = allOrders.filter(o =>
        !(o.order_type === "takeaway" && o.table_id)
      );
      const seen = new Set();
      const deduped = standaloneOrders.filter(o => {
        if (o.order_type === "takeaway") return true; // standalone takeaway
        if (!seen.has(o.table_id)) { seen.add(o.table_id); return true; }
        return false;
      });
      // Attach any table-assigned takeaway orders so the card can show them
      const tableAssignedTakeaways = allOrders.filter(o =>
        o.order_type === "takeaway" && o.table_id
      );
      const dedupedWithMeta = deduped.map(o => {
        if (o.order_type !== "takeaway" && o.table_id) {
          const linked = tableAssignedTakeaways.filter(t => t.table_id === o.table_id);
          return { ...o, _takeawayOrders: linked };
        }
        return { ...o, _takeawayOrders: [] };
      });
      setOrders(dedupedWithMeta.sort((a, b) => a.id - b.id));
      setTables(tblRes.data);
      setTaxSettings(taxRes.data);
    } catch {}
    setLoading(false);
  }, []);

  const loadMenu = useCallback(async () => {
    try { const r = await API.get("/menu"); setMenu(r.data.filter(i => i.is_available)); } catch {}
  }, []);

  useEffect(() => { loadOrders(); loadMenu(); }, [loadOrders, loadMenu]);
  useEffect(() => { const t = setInterval(loadOrders, 15000); return () => clearInterval(t); }, [loadOrders]);

  const selectOrder = async (order) => {
    setSelectedOrder(order);
    setBillLoading(true);
    setStep("detail");
    setDiscountType("percent");
    setDiscountValue("");
    try {
      const res = await API.get(`/orders/${order.id}/bill`);
      setBill(res.data);
    } catch {}
    setBillLoading(false);
  };

  const handleProceedPayment = () => setStep("payment");

  const handleChooseMethod = (method) => {
    setPayMethod(method);
    if (method === "credit") {
      setCreditModal(true);
    } else {
      setStep("confirm");
    }
  };

  // Compute derived discount values from current bill + discount inputs
  const getDiscountCalc = () => {
    if (!bill) return { discountAmt: 0, grandTotal: 0, totalWithTax: 0 };
    const totalWithTax = Number(bill.total);
    const { discountAmt, grandTotal } = computeDiscount(totalWithTax, discountType, discountValue);
    return { discountAmt, grandTotal, totalWithTax };
  };

  const handleConfirmPay = async () => {
    if (!selectedOrder || !payMethod) return;
    setPaying(true);
    const { discountAmt } = getDiscountCalc();
    try {
      await API.put(`/orders/${selectedOrder.id}/pay`, {
        method: payMethod,
        discount_amount: discountAmt,
      });
      const r = await API.get(`/orders/${selectedOrder.id}/bill`);
      setFinalBill({ ...r.data, payment_method: payMethod, discount_amount: discountAmt });
      setStep("bill");
      await loadOrders();
    } catch {}
    setPaying(false);
  };

  const handleCreditPay = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !bill) return;
    setPaying(true);
    const { discountAmt, grandTotal } = getDiscountCalc();
    try {
      // For credit, record the grand total after discount as the credit amount
      await API.post("/credits", {
        order_id: selectedOrder.id,
        customer_name: creditForm.customer_name,
        customer_phone: creditForm.customer_phone,
        amount: grandTotal,
        deadline: creditForm.deadline,
        notes: creditForm.notes,
      });
      // Also store the discount on the order (pay endpoint with credit method)
      await API.put(`/orders/${selectedOrder.id}/pay`, {
        method: "credit",
        discount_amount: discountAmt,
      });
      const r = await API.get(`/orders/${selectedOrder.id}/bill`);
      setFinalBill({
        ...r.data,
        payment_method: "credit",
        credit_customer: creditForm.customer_name,
        discount_amount: discountAmt,
      });
      setCreditModal(false);
      setCreditForm({ customer_name: "", customer_phone: "", deadline: "", notes: "" });
      setStep("bill");
      await loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || "Credit payment failed");
    }
    setPaying(false);
  };

  const handleReserveTable = async (e) => {
    e.preventDefault();
    if (!reserveModal) return;
    setReserving(true);
    try {
      await API.post(`/tables/${reserveModal.id}/reserve`, reserveForm);
      setReserveModal(null);
      setReserveForm({ reserved_by_name: "", reserved_by_phone: "" });
      await loadOrders();
    } catch (err) { alert(err.response?.data?.error || "Failed to reserve"); }
    setReserving(false);
  };

  const updateTableStatus = async (tableId, status) => {
    try { await API.put(`/tables/${tableId}`, { status }); await loadOrders(); } catch {}
  };

  const handleNewTakeaway = async () => {
    try {
      const res = await API.post("/orders", { order_type: "takeaway" });
      setTakeawayOrder(res.data);
      setTakeawayItems([]);
      setTakeawayModal(true);
    } catch {}
  };

  const addTakeawayItem = async (menuItem) => {
    if (!takeawayOrder) return;
    try {
      await API.post(`/orders/${takeawayOrder.id}/items`, { menu_id: menuItem.id, quantity: 1 });
      const detail = await API.get(`/orders/${takeawayOrder.id}`);
      setTakeawayItems(detail.data.items);
      setTakeawayOrder(detail.data.order);
    } catch {}
  };

  const confirmTakeaway = async () => {
    if (!takeawayOrder) return;
    setSavingTakeaway(true);
    try {
      await API.put(`/orders/${takeawayOrder.id}/confirm`);
      setTakeawayModal(false);
      setTakeawayOrder(null);
      setTakeawayItems([]);
      await loadOrders();
    } catch {}
    setSavingTakeaway(false);
  };

  const resetToList = () => {
    setStep("list");
    setSelectedOrder(null);
    setBill(null);
    setPayMethod(null);
    setFinalBill(null);
    setDiscountType("percent");
    setDiscountValue("");
  };

  const handleLogout = async () => {
    try { await API.post("/auth/logout"); } catch {}
    logout(); navigate("/cash-counter");
  };

  const handlePrint = () => window.print();

  const statusLabel = { pending: "Pending", preparing: "Preparing", served: "Ready", credit_pending: "Credit" };
  const statusColor = { pending: "var(--warning)", preparing: "var(--info)", served: "var(--success)", credit_pending: "#8b5cf6" };
  const catIcons = { food: "🍛", drink: "🥤", dessert: "🍰", snack: "🍿" };
  const categories = [...new Set(menu.map(m => m.category))];
  const roundColors = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6"];

  const groupItemsByRound = (items, roundMap) => {
    if (!items) return [];
    const groups = {};
    items.forEach(item => {
      const key = item.order_id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).map(([orderId, items]) => ({
      orderId: parseInt(orderId),
      roundNumber: roundMap?.[orderId] || 1,
      items,
    })).sort((a, b) => a.roundNumber - b.roundNumber);
  };

  const { discountAmt, grandTotal: liveGrandTotal } = getDiscountCalc();
  const hasDiscount = discountAmt > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column" }}>

      {/* HEADER */}
      <header className="no-print" style={{
        background: "linear-gradient(135deg,#1e293b,#0f172a)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 0 16px rgba(99,102,241,0.4)" }}>💰</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#f1f5f9" }}>Cash Counter</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{user?.restaurant_name} · {user?.name}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "6px 16px", display: "flex", gap: 16, fontSize: 12 }}>
            <span style={{ color: "#fbbf24", fontWeight: 700 }}>⏳ {orders.filter(o => ["pending","preparing"].includes(o.status)).length} Active</span>
            <span style={{ color: "#34d399", fontWeight: 700 }}>✅ {orders.filter(o => o.status === "served").length} Ready</span>
          </div>
          <button onClick={handleNewTakeaway} style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 800, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>📦 Takeaway</button>
          <button className="btn btn-secondary btn-sm" onClick={loadOrders}>↻</button>
          <button className="theme-toggle" onClick={toggleTheme}><span>{theme === "dark" ? "🌙" : "☀️"}</span></button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ color: "rgba(255,255,255,0.6)" }}>🚪</button>
        </div>
      </header>

      {/* MAIN BODY */}
      <div className="no-print" style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 440px", overflow: "hidden" }}>

        {/* LEFT: ORDERS LIST */}
        <div style={{ overflow: "auto", padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>🧾 Active Orders</div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
          ) : orders.length === 0 ? (
            <div className="empty-state" style={{ marginBottom: 32 }}>
              <div className="empty-icon">🧾</div>
              <h3>No active orders</h3>
              <p>Waiter orders will appear here after confirmed.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
              {orders.map(order => {
                const isSelected = selectedOrder?.id === order.id;
                const isTakeaway = order.order_type === "takeaway";
                const subtotal = Number(order.combined_total !== undefined ? order.combined_total : order.total) || 0;
                const cardTaxEnabled = taxSettings ? taxSettings.tax_enabled !== false : false;
                const cardTaxRate = taxSettings ? (parseFloat(taxSettings.tax_rate) || 13) : 13;
                const cardTax = cardTaxEnabled ? Math.round(subtotal * cardTaxRate) / 100 : 0;
                const displayTotal = Math.round((subtotal + cardTax) * 100) / 100;
                return (
                  <div key={order.id} onClick={() => selectOrder(order)} style={{
                    background: isSelected ? "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))" : "var(--bg-card)",
                    border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 14, padding: "14px 18px", cursor: "pointer", transition: "all 0.2s",
                    display: "flex", alignItems: "center", gap: 14,
                  }}
                  onMouseOver={e => { if (!isSelected) e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onMouseOut={e => { if (!isSelected) e.currentTarget.style.borderColor = "var(--border)"; }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: isTakeaway ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                      {isTakeaway ? "📦" : "🪑"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, fontSize: 15 }}>
                            {isTakeaway ? <span style={{ color: "#f59e0b" }}>TAKEAWAY</span> : `Table ${order.table_number}`}
                          </span>
                          {!isTakeaway && order._takeawayOrders?.length > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 20, padding: "2px 8px" }}>
                              📦 +Takeaway
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${statusColor[order.status]}22`, color: statusColor[order.status], border: `1px solid ${statusColor[order.status]}44` }}>
                          {statusLabel[order.status] || order.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)" }}>
                        <span>🕐 {timeSince(order.created_at)}</span>
                        {order.waiter_name && <span>👤 {order.waiter_name}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 17, color: "var(--success)" }}>
                        Rs. {Number(displayTotal).toLocaleString()}
                      </div>
                      {cardTaxEnabled && cardTax > 0 && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                          incl. {cardTaxRate}% VAT
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                        {formatTime(order.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE STATUS */}
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>🪑 Table Status</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
            {tables.map(t => (
              <div key={t.id} className={`table-tile ${t.status}`} style={{ position: "relative" }}>
                <div className="tile-num">#{t.table_number}</div>
                <div className="tile-status">{t.status}</div>
                {t.status === "reserved" && (
                  <div style={{ fontSize: 10, marginTop: 2, color: "var(--accent-light)", fontWeight: 600 }}>
                    📋 {t.reserved_by_name}
                    {t.reserved_by_phone && <div style={{ opacity: 0.8 }}>📞 {t.reserved_by_phone}</div>}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>👥 {t.capacity}</div>
                <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                  {t.status !== "available" && (
                    <button onClick={() => updateTableStatus(t.id, "available")} style={{ flex: 1, minWidth: 50, background: "var(--success-bg)", border: "1px solid var(--success)", color: "var(--success)", borderRadius: 6, padding: "2px 4px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Free</button>
                  )}
                  {t.status !== "reserved" && (
                    <button onClick={() => { setReserveModal(t); setReserveForm({ reserved_by_name: "", reserved_by_phone: "" }); }} style={{ flex: 1, minWidth: 50, background: "var(--accent-bg,#eef2ff)", border: "1px solid var(--accent)", color: "var(--accent)", borderRadius: 6, padding: "2px 4px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Reserve</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: BILL PANEL */}
        <div style={{ borderLeft: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", flexDirection: "column", overflow: "auto" }}>
          {step === "list" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--text-muted)", padding: 40 }}>
              <div style={{ fontSize: 52 }}>🧾</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Select an order</div>
              <div style={{ fontSize: 13, textAlign: "center" }}>Click any active order from the left panel to view details and process payment.</div>
            </div>
          )}

          {(step === "detail" || step === "payment" || step === "confirm") && selectedOrder && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", alignItems: "center", gap: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={resetToList}>← Back</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>
                    {selectedOrder.order_type === "takeaway"
                      ? "📦 Takeaway Order"
                      : selectedOrder._takeawayOrders?.length > 0
                        ? `🪑 Table ${selectedOrder.table_number} + 📦 Takeaway`
                        : `🪑 Table ${selectedOrder.table_number}`}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>#{selectedOrder.id} · {selectedOrder.waiter_name || "—"}</div>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${statusColor[selectedOrder.status]}22`, color: statusColor[selectedOrder.status] }}>
                  {statusLabel[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>

              {billLoading ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="spinner" /></div>
              ) : bill ? (
                <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
                  {/* Multi-round notice */}
                  {bill.allOrderIds?.length > 1 && (
                    <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid var(--accent)33", borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                      📋 {bill.allOrderIds.length} orders combined — showing full bill
                      {selectedOrder?._takeawayOrders?.length > 0 && (
                        <span style={{ marginLeft: 8, background: "rgba(245,158,11,0.15)", color: "#f59e0b", borderRadius: 12, padding: "2px 8px", fontSize: 11 }}>
                          includes 📦 {selectedOrder._takeawayOrders.length} takeaway order{selectedOrder._takeawayOrders.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Items */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Order Items {bill.allOrderIds?.length > 1 ? `(${bill.allOrderIds.length} rounds)` : ""}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {bill.items?.map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-surface)", borderRadius: 10, border: "1px solid var(--border)" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Qty: {item.quantity}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: "var(--success)", fontSize: 14 }}>Rs. {Number(item.price).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals box with discount section */}
                  <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
                      <span>Rs. {Number(bill.subtotal).toLocaleString()}</span>
                    </div>
                    {bill.tax_enabled && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10 }}>
                        <span style={{ color: "var(--text-muted)" }}>VAT ({bill.tax_rate}%)</span>
                        <span>Rs. {Number(bill.tax).toLocaleString()}</span>
                      </div>
                    )}

                    {/* ── DISCOUNT SECTION ── */}
                    <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        🎁 Discount
                        <span style={{ fontSize: 11, fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                        {/* Type toggle */}
                        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
                          {[
                            { key: "percent", label: "%" },
                            { key: "fixed",   label: "Rs." },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => { setDiscountType(opt.key); setDiscountValue(""); }}
                              style={{
                                padding: "7px 12px",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                border: "none",
                                background: discountType === opt.key ? "var(--accent)" : "var(--bg-secondary)",
                                color: discountType === opt.key ? "#fff" : "var(--text-muted)",
                                transition: "all 0.15s",
                              }}
                            >{opt.label}</button>
                          ))}
                        </div>
                        {/* Value input */}
                        <input
                          type="number"
                          min="0"
                          step={discountType === "percent" ? "0.5" : "1"}
                          max={discountType === "percent" ? "100" : undefined}
                          placeholder={discountType === "percent" ? "e.g. 5 or 10" : "e.g. 150"}
                          value={discountValue}
                          onChange={e => setDiscountValue(e.target.value)}
                          style={{
                            flex: 1,
                            padding: "7px 12px",
                            fontSize: 14,
                            fontWeight: 600,
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            background: "var(--bg-primary)",
                            color: "var(--text-primary)",
                            outline: "none",
                          }}
                        />
                        {discountValue && (
                          <button
                            type="button"
                            onClick={() => setDiscountValue("")}
                            style={{ padding: "7px 10px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--text-muted)", fontSize: 14 }}
                            title="Clear discount"
                          >✕</button>
                        )}
                      </div>

                      {/* Quick-pick percent buttons */}
                      {discountType === "percent" && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          {[5, 10, 15, 20, 25, 50].map(pct => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setDiscountValue(String(pct))}
                              style={{
                                padding: "4px 10px",
                                fontSize: 12,
                                fontWeight: 700,
                                borderRadius: 20,
                                cursor: "pointer",
                                border: "1px solid var(--border)",
                                background: discountValue === String(pct) ? "var(--accent)" : "var(--bg-secondary)",
                                color: discountValue === String(pct) ? "#fff" : "var(--text-secondary)",
                                transition: "all 0.15s",
                              }}
                            >{pct}%</button>
                          ))}
                        </div>
                      )}

                      {/* Live discount preview */}
                      {hasDiscount && (
                        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--danger, #ef4444)", fontWeight: 700 }}>
                          <span>Discount {discountType === "percent" ? `(${discountValue}%)` : ""}</span>
                          <span>− Rs. {discountAmt.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Grand total */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 22, color: "var(--success)", borderTop: "2px dashed var(--border)", paddingTop: 10 }}>
                      <span>Grand Total</span>
                      <span>Rs. {liveGrandTotal.toLocaleString()}</span>
                    </div>
                    {hasDiscount && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 2 }}>
                        (original Rs. {Number(bill.total).toLocaleString()})
                      </div>
                    )}
                  </div>

                  {step === "detail" && (
                    <button className="btn btn-primary" onClick={handleProceedPayment} style={{ width: "100%", padding: "14px 0", fontWeight: 900, fontSize: 16, borderRadius: 12 }}>
                      💳 Proceed to Payment
                    </button>
                  )}

                  {step === "payment" && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Select Payment Method</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[
                          { method: "cash",   icon: "💵", label: "Cash",              desc: "Physical cash payment",               color: "#16a34a", bg: "#f0fdf4" },
                          { method: "online", icon: "📱", label: "Online / QR",       desc: "eSewa, Khalti, IME Pay, QR",           color: "#2563eb", bg: "#eff6ff" },
                          { method: "credit", icon: "📋", label: "Credit (Pay Later)", desc: "Record as pending payment",            color: "#8b5cf6", bg: "#f5f3ff" },
                        ].map(opt => (
                          <button key={opt.method} onClick={() => handleChooseMethod(opt.method)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 12, cursor: "pointer", background: opt.bg, border: `2px solid ${opt.color}33`, textAlign: "left", transition: "all 0.2s" }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = opt.color; e.currentTarget.style.transform = "translateX(4px)"; }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = `${opt.color}33`; e.currentTarget.style.transform = "translateX(0)"; }}>
                            <span style={{ fontSize: 28 }}>{opt.icon}</span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 15, color: opt.color }}>{opt.label}</div>
                              <div style={{ fontSize: 12, color: "#6b7280" }}>{opt.desc}</div>
                            </div>
                            <div style={{ marginLeft: "auto", color: opt.color, fontSize: 18 }}>→</div>
                          </button>
                        ))}
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, width: "100%" }} onClick={() => setStep("detail")}>← Back to Order Details</button>
                    </div>
                  )}

                  {step === "confirm" && payMethod && (
                    <div>
                      <div style={{ background: "var(--bg-surface)", border: "2px solid var(--accent)", borderRadius: 14, padding: 20, textAlign: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 42, marginBottom: 8 }}>{payMethod === "cash" ? "💵" : "📱"}</div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>{payMethod === "cash" ? "Cash Payment" : "Online Payment"}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>Confirm payment of</div>
                        {hasDiscount && (
                          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4, textDecoration: "line-through" }}>
                            Rs. {Number(bill.total).toLocaleString()}
                          </div>
                        )}
                        <div style={{ fontSize: 32, fontWeight: 900, color: "var(--success)" }}>
                          Rs. {liveGrandTotal.toLocaleString()}
                        </div>
                        {hasDiscount && (
                          <div style={{ marginTop: 4, fontSize: 12, color: "#ef4444", fontWeight: 700 }}>
                            🎁 Discount applied: − Rs. {discountAmt.toLocaleString()}
                            {discountType === "percent" && ` (${discountValue}%)`}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                          {selectedOrder.order_type === "takeaway" ? "📦 Takeaway Order" : `🪑 Table ${selectedOrder.table_number}`}
                          {bill.allOrderIds?.length > 1 && ` · ${bill.allOrderIds.length} rounds`}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep("payment")}>← Change</button>
                        <button className="btn btn-success" style={{ flex: 2, fontWeight: 900, fontSize: 15, padding: "12px 0" }} onClick={handleConfirmPay} disabled={paying}>
                          {paying ? <><span className="spinner-sm" /> Processing...</> : "✅ Confirm Payment"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ color: "var(--text-muted)" }}>Failed to load bill</div>
                </div>
              )}
            </div>
          )}

          {step === "bill" && finalBill && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handlePrint}>🖨️ Print Bill</button>
                <button className="btn btn-ghost btn-sm" onClick={resetToList}>← New Order</button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
                <Receipt bill={finalBill} roundColors={roundColors} groupItemsByRound={groupItemsByRound} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY RECEIPT */}
      {step === "bill" && finalBill && (
        <div className="print-only">
          <Receipt bill={finalBill} roundColors={roundColors} groupItemsByRound={groupItemsByRound} />
        </div>
      )}

      {/* CREDIT MODAL */}
      {creditModal && (
        <div className="modal-overlay no-print" onClick={() => setCreditModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Credit Payment</h3>
              <button className="modal-close" onClick={() => setCreditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreditPay}>
              <div className="modal-body">
                <div style={{ background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 10, padding: "12px 14px", marginBottom: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📋</div>
                  {hasDiscount && (
                    <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, marginBottom: 4 }}>
                      🎁 Discount − Rs. {discountAmt.toLocaleString()} applied
                    </div>
                  )}
                  <div style={{ fontWeight: 800, color: "#7c3aed", fontSize: 18 }}>
                    Rs. {bill ? liveGrandTotal.toLocaleString() : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Will be recorded as pending. Not counted in sales until received.</div>
                </div>
                <div className="form-group"><label>Customer Name *</label><input required placeholder="Full name" value={creditForm.customer_name} onChange={e => setCreditForm({ ...creditForm, customer_name: e.target.value })} /></div>
                <div className="form-group"><label>Contact Number *</label><input required placeholder="Phone number" value={creditForm.customer_phone} onChange={e => setCreditForm({ ...creditForm, customer_phone: e.target.value })} /></div>
                <div className="form-group"><label>Payment Deadline *</label><input required type="date" value={creditForm.deadline} onChange={e => setCreditForm({ ...creditForm, deadline: e.target.value })} /></div>
                <div className="form-group"><label>Notes (Optional)</label><input placeholder="Any notes..." value={creditForm.notes} onChange={e => setCreditForm({ ...creditForm, notes: e.target.value })} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setCreditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={paying}>{paying ? <><span className="spinner-sm" /> Saving...</> : "📋 Record Credit"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESERVE MODAL */}
      {reserveModal && (
        <div className="modal-overlay no-print" onClick={() => setReserveModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Reserve Table #{reserveModal.table_number}</h3>
              <button className="modal-close" onClick={() => setReserveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleReserveTable}>
              <div className="modal-body">
                <div className="form-group"><label>Reserved By (Name) *</label><input required placeholder="Customer name" value={reserveForm.reserved_by_name} onChange={e => setReserveForm({ ...reserveForm, reserved_by_name: e.target.value })} /></div>
                <div className="form-group"><label>Contact Number *</label><input required placeholder="Phone number" value={reserveForm.reserved_by_phone} onChange={e => setReserveForm({ ...reserveForm, reserved_by_phone: e.target.value })} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setReserveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={reserving}>{reserving ? <><span className="spinner-sm" /> Reserving...</> : "📋 Reserve Table"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAKEAWAY MODAL */}
      {takeawayModal && (
        <div className="modal-overlay no-print" onClick={() => setTakeawayModal(false)}>
          <div className="modal" style={{ maxWidth: 680, width: "90vw" }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📦 New Takeaway Order</h3>
              <button className="modal-close" onClick={() => setTakeawayModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 16 }}>
              <div style={{ maxHeight: 400, overflow: "auto" }}>
                {categories.map(cat => (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>{catIcons[cat]} {cat}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      {menu.filter(m => m.category === cat).map(item => (
                        <button key={item.id} onClick={() => addTakeawayItem(item)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", cursor: "pointer", textAlign: "left", color: "var(--text-primary)" }}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{item.name}</div>
                          <div style={{ color: "var(--success)", fontWeight: 700, fontSize: 12 }}>Rs. {Number(item.price).toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Order Items</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflow: "auto" }}>
                  {takeawayItems.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 20 }}>No items yet</div>
                  ) : takeawayItems.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <span>{item.name} <span style={{ color: "var(--text-muted)" }}>×{item.quantity}</span></span>
                      <span style={{ fontWeight: 600 }}>Rs. {Number(item.price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                {takeawayOrder && (
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--success)", marginTop: 12, paddingTop: 8, borderTop: "2px dashed var(--border)" }}>
                    Total: Rs. {Number(takeawayOrder.total || 0).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setTakeawayModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ fontWeight: 800 }} onClick={confirmTakeaway} disabled={savingTakeaway || takeawayItems.length === 0}>
                {savingTakeaway ? <><span className="spinner-sm" /> Sending...</> : "📦 Send to Kitchen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RECEIPT COMPONENT ────────────────────────────────────────────────────────
function Receipt({ bill, roundColors, groupItemsByRound }) {
  const now = new Date();
  const methodIcons = { cash: "💵", online: "📱", credit: "📋" };
  const hasMultipleRounds = bill.allOrderIds?.length > 1;

  // Prefer the passed-in discount_amount (set at payment time), fallback to bill field
  const discountAmount = parseFloat(bill.discount_amount) || 0;
  const hasDiscount = discountAmount > 0;

  // Recompute receipt totals from bill data
  const subtotal   = parseFloat(bill.subtotal)  || 0;
  const tax        = parseFloat(bill.tax)        || 0;
  const totalWithTax = parseFloat((subtotal + tax).toFixed(2));
  const grandTotal = hasDiscount
    ? parseFloat((totalWithTax - discountAmount).toFixed(2))
    : parseFloat(bill.total) || 0;

  return (
    <div className="receipt-thermal">
      {/* Restaurant Header */}
      <div className="receipt-header">
        <div className="receipt-restaurant-name">{bill.restaurant_name || "Restaurant"}</div>
        {bill.restaurant_address && <div className="receipt-meta">{bill.restaurant_address}</div>}
        {bill.restaurant_phone  && <div className="receipt-meta">Tel: {bill.restaurant_phone}</div>}
        {bill.pan_number        && <div className="receipt-meta">PAN: {bill.pan_number}</div>}
      </div>

      <div className="receipt-divider-dashed" />

      {/* Order Info */}
      <div className="receipt-info-grid">
        <span className="receipt-label">Bill No:</span><span className="receipt-value">#{bill.order?.id}</span>
        <span className="receipt-label">Date:</span><span className="receipt-value">{now.toLocaleDateString("en-NP")}</span>
        <span className="receipt-label">Time:</span><span className="receipt-value">{now.toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit" })}</span>
        <span className="receipt-label">Order:</span>
        <span className="receipt-value receipt-bold">
          {bill.order?.order_type === "takeaway" ? "Takeaway" : `Table ${bill.order?.table_number}`}
        </span>
        {bill.waiter_name && <><span className="receipt-label">Waiter:</span><span className="receipt-value">{bill.waiter_name}</span></>}
        {hasMultipleRounds && (
          <><span className="receipt-label">Rounds:</span><span className="receipt-value receipt-bold">{bill.allOrderIds.length}</span></>
        )}
        <span className="receipt-label">Payment:</span>
        <span className="receipt-value receipt-bold" style={{ textTransform: "capitalize" }}>
          {methodIcons[bill.payment_method]} {bill.payment_method}
          {bill.credit_customer && ` — ${bill.credit_customer}`}
        </span>
      </div>

      <div className="receipt-divider-dashed" />

      {/* Items */}
      <div className="receipt-col-header">
        <span style={{ flex: 1 }}>ITEM</span>
        <span style={{ width: 28, textAlign: "center" }}>QTY</span>
        <span style={{ width: 72, textAlign: "right" }}>AMT</span>
      </div>
      <div className="receipt-divider-light" />

      {bill.items?.map((item, i) => (
        <div key={i} className="receipt-item-row">
          <span style={{ flex: 1, overflow: "hidden" }}>{item.name}</span>
          <span style={{ width: 28, textAlign: "center" }}>{item.quantity}</span>
          <span style={{ width: 72, textAlign: "right" }}>Rs.{Number(item.price).toLocaleString()}</span>
        </div>
      ))}

      <div className="receipt-divider-dashed" />

      {/* Totals */}
      <div className="receipt-totals">
        <div className="receipt-total-row">
          <span>Subtotal</span><span>Rs. {subtotal.toLocaleString()}</span>
        </div>
        {bill.tax_enabled && tax > 0 && (
          <div className="receipt-total-row">
            <span>VAT ({bill.tax_rate}%)</span><span>Rs. {tax.toLocaleString()}</span>
          </div>
        )}
        {hasDiscount && (
          <>
            {/* <div className="receipt-total-row" style={{ color: "inherit", opacity: 0.75 }}>
              <span>Total (before discount)</span><span>Rs. {totalWithTax.toLocaleString()}</span>
            </div> */}
            <div className="receipt-total-row" style={{ fontWeight: 700 }}>
              <span>Discount</span><span>− Rs. {discountAmount.toLocaleString()}</span>
            </div>
          </>
        )}
        <div className="receipt-total-row receipt-grand-total">
          <span>{hasDiscount ? "GRAND TOTAL" : "TOTAL"}</span>
          <span>Rs. {grandTotal.toLocaleString()}</span>
        </div>
      </div>

      <div className="receipt-divider-dashed" />

      {/* Footer */}
      <div className="receipt-footer">
        {bill.payment_method === "credit"
          ? <div style={{ color: "#7c3aed", fontWeight: 700 }}>⚠️ CREDIT — Payment Pending</div>
          : <div style={{ color: "#16a34a", fontWeight: 700 }}>✅ Payment Received</div>
        }
        {/* {hasDiscount && (
          <div style={{ marginTop: 4, fontSize: 11 }}>🎁 Discount of Rs. {discountAmount.toLocaleString()} applied</div>
        )} */}
        <div style={{ marginTop: 6 }}>धन्यवाद! / Thank you for dining with us!</div>
      </div>
    </div>
  );
}
