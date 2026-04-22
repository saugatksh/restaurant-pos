import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../api";

/* ─── Global Styles ─────────────────────────────────────────────────────── */
const GLOBAL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root { --font:'Outfit',sans-serif; --t-fast:all 0.15s ease; --t-base:all 0.25s ease; }

[data-theme="dark"] {
  --bg-base:#0b0d12; --bg-surface:#111318; --bg-card:#161921;
  --bg-elevated:#1c1f2a; --bg-hover:#1e2130; --bg-input:#0e1016;
  --border:rgba(255,255,255,0.07); --border-md:rgba(255,255,255,0.11);
  --border-focus:rgba(251,191,36,0.5);
  --text-primary:#f0eee9; --text-secondary:#b0aaa0; --text-muted:#6b6760;
  --accent:#f59e0b; --accent-bg:rgba(245,158,11,0.12); --accent-border:rgba(245,158,11,0.3);
  --success:#10b981; --success-bg:rgba(16,185,129,0.12); --success-border:rgba(16,185,129,0.3);
  --danger:#f43f5e; --danger-bg:rgba(244,63,94,0.12);
  --warning:#f59e0b; --warning-bg:rgba(245,158,11,0.1);
  --info:#38bdf8; --info-bg:rgba(56,189,248,0.1);
  --shadow-sm:0 1px 3px rgba(0,0,0,0.5); --shadow-md:0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg:0 12px 40px rgba(0,0,0,0.6); --overlay:rgba(0,0,0,0.72);
  --sidebar-bg:#0e1016;
  --gradient-brand:linear-gradient(135deg,#f59e0b,#d97706);
  --gradient-hero:linear-gradient(135deg,rgba(245,158,11,0.14),rgba(217,119,6,0.04));
  --cat-active-bg:rgba(245,158,11,0.18); --cat-active-border:rgba(245,158,11,0.45); --cat-active-text:#fbbf24;
  --sub-active-bg:rgba(99,102,241,0.18); --sub-active-border:rgba(99,102,241,0.4); --sub-active-text:#a5b4fc;
}
[data-theme="light"] {
  --bg-base:#f5f2ec; --bg-surface:#ede9e1; --bg-card:#ffffff;
  --bg-elevated:#ffffff; --bg-hover:#f9f7f3; --bg-input:#f9f7f3;
  --border:rgba(0,0,0,0.08); --border-md:rgba(0,0,0,0.13);
  --border-focus:rgba(217,119,6,0.5);
  --text-primary:#1a1714; --text-secondary:#5a5550; --text-muted:#9e9890;
  --accent:#d97706; --accent-bg:rgba(217,119,6,0.08); --accent-border:rgba(217,119,6,0.25);
  --success:#059669; --success-bg:rgba(5,150,105,0.08); --success-border:rgba(5,150,105,0.25);
  --danger:#e11d48; --danger-bg:rgba(225,29,72,0.08);
  --warning:#d97706; --warning-bg:rgba(217,119,6,0.08);
  --info:#0284c7; --info-bg:rgba(2,132,199,0.08);
  --shadow-sm:0 1px 3px rgba(0,0,0,0.08); --shadow-md:0 4px 16px rgba(0,0,0,0.1);
  --shadow-lg:0 12px 40px rgba(0,0,0,0.12); --overlay:rgba(0,0,0,0.45);
  --sidebar-bg:#ffffff;
  --gradient-brand:linear-gradient(135deg,#f59e0b,#b45309);
  --gradient-hero:linear-gradient(135deg,rgba(217,119,6,0.07),rgba(180,83,9,0.02));
  --cat-active-bg:rgba(217,119,6,0.1); --cat-active-border:rgba(217,119,6,0.3); --cat-active-text:#b45309;
  --sub-active-bg:rgba(99,102,241,0.1); --sub-active-border:rgba(99,102,241,0.3); --sub-active-text:#4f46e5;
}

body,html{font-family:var(--font);}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--border-md);border-radius:10px;}

@keyframes spin{to{transform:rotate(360deg);}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);}}
@keyframes slideDown{from{opacity:0;transform:translateY(-5px);}to{opacity:1;transform:translateY(0);}}

.spinner{width:22px;height:22px;border:2px solid var(--border-md);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite;}
.spinner-sm{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:7px;font-family:var(--font);font-weight:600;font-size:14px;padding:9px 18px;border-radius:10px;cursor:pointer;border:none;transition:var(--t-fast);line-height:1;white-space:nowrap;}
.btn:active{transform:scale(0.97);}
.btn-primary{background:var(--gradient-brand);color:#fff;box-shadow:0 2px 8px rgba(245,158,11,0.3);}
.btn-primary:hover{filter:brightness(1.06);box-shadow:0 4px 16px rgba(245,158,11,0.4);}
.btn-secondary{background:var(--bg-elevated);color:var(--text-primary);border:1px solid var(--border-md);}
.btn-secondary:hover{background:var(--bg-hover);border-color:var(--border-focus);}
.btn-ghost{background:transparent;color:var(--text-secondary);border:1px solid transparent;}
.btn-ghost:hover{background:var(--bg-hover);color:var(--text-primary);border-color:var(--border);}
.btn-sm{padding:7px 13px;font-size:13px;border-radius:8px;}

/* Badges */
.badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.02em;}
.badge-success{background:var(--success-bg);color:var(--success);border:1px solid var(--success-border);}
.badge-warning{background:var(--warning-bg);color:var(--warning);border:1px solid var(--accent-border);}

/* Tables */
.table-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;}
.table-tile{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px 14px;text-align:center;cursor:pointer;transition:var(--t-base);animation:fadeIn 0.3s ease both;position:relative;overflow:hidden;}
.table-tile::before{content:'';position:absolute;inset:0;background:var(--gradient-hero);opacity:0;transition:opacity 0.2s ease;}
.table-tile:hover::before{opacity:1;}
.table-tile:hover{border-color:var(--accent-border);transform:translateY(-3px);box-shadow:var(--shadow-md);}
.table-tile.occupied{border-color:var(--accent-border);background:var(--accent-bg);}
.table-tile.reserved{border-color:rgba(139,92,246,0.3);background:rgba(139,92,246,0.06);}
.tile-num{font-size:22px;font-weight:800;color:var(--text-primary);letter-spacing:-0.02em;}
.tile-cap{font-size:11px;color:var(--text-muted);margin-top:2px;}
.tile-status{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:2px 8px;border-radius:10px;margin-top:6px;}
.tile-s-available{background:var(--success-bg);color:var(--success);}
.tile-s-occupied{background:var(--warning-bg);color:var(--warning);}
.tile-s-reserved{background:rgba(139,92,246,0.1);color:#8b5cf6;}

/* Order panel */
.order-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-md);overflow:hidden;display:flex;flex-direction:column;}
.order-panel-hdr{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface);}
.order-item-row{display:flex;align-items:center;padding:10px 18px;border-bottom:1px solid var(--border);gap:10px;transition:background 0.12s;}
.order-item-row:hover{background:var(--bg-hover);}
.order-total-bar{padding:14px 18px;border-top:1px solid var(--border);background:var(--bg-surface);}

/* Search */
.search-wrap{position:relative;display:flex;align-items:center;}
.search-input{width:100%;padding:10px 40px 10px 40px;background:var(--bg-input);border:1px solid var(--border-md);border-radius:11px;font-family:var(--font);font-size:14px;color:var(--text-primary);outline:none;transition:var(--t-fast);}
.search-input::placeholder{color:var(--text-muted);}
.search-input:focus{border-color:var(--border-focus);background:var(--bg-card);box-shadow:0 0 0 3px var(--accent-bg);}
.search-icon{position:absolute;left:13px;font-size:15px;pointer-events:none;opacity:0.5;}
.search-clear{position:absolute;right:10px;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:2px 4px;border-radius:4px;transition:color 0.12s;line-height:1;}
.search-clear:hover{color:var(--text-primary);}

/* Category nav */
.cat-nav{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:1px;}
.cat-nav::-webkit-scrollbar{display:none;}
.cat-pill{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:22px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border-md);background:var(--bg-elevated);color:var(--text-secondary);transition:var(--t-fast);white-space:nowrap;flex-shrink:0;font-family:var(--font);}
.cat-pill:hover{border-color:var(--accent-border);color:var(--accent);}
.cat-pill.active{background:var(--cat-active-bg);border-color:var(--cat-active-border);color:var(--cat-active-text);}

/* Sub-category nav */
.sub-nav{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding-bottom:1px;}
.sub-nav::-webkit-scrollbar{display:none;}
.sub-pill{display:inline-flex;align-items:center;gap:3px;padding:4px 13px;border-radius:14px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text-muted);transition:var(--t-fast);white-space:nowrap;flex-shrink:0;font-family:var(--font);}
.sub-pill:hover{border-color:var(--sub-active-border);color:var(--sub-active-text);}
.sub-pill.active{background:var(--sub-active-bg);border-color:var(--sub-active-border);color:var(--sub-active-text);}

/* Menu item card */
.menu-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:13px;text-align:left;cursor:pointer;transition:var(--t-fast);font-family:var(--font);color:var(--text-primary);position:relative;overflow:hidden;}
.menu-card:hover:not(:disabled){border-color:var(--accent-border);transform:translateY(-2px);box-shadow:var(--shadow-md);}
.menu-card:active:not(:disabled){transform:translateY(0);}
.menu-card:disabled{opacity:0.36;cursor:not-allowed;}
.menu-card.special{border-color:var(--accent-border);background:var(--accent-bg);}

mark{background:rgba(245,158,11,0.3);color:inherit;border-radius:2px;padding:0 1px;}

/* Theme toggle */
.theme-btn{display:flex;align-items:center;gap:8px;padding:7px 13px;border-radius:20px;border:1px solid var(--border-md);background:var(--bg-elevated);cursor:pointer;font-family:var(--font);font-size:13px;font-weight:600;color:var(--text-secondary);transition:var(--t-fast);}
.theme-btn:hover{border-color:var(--accent-border);color:var(--text-primary);}
.tog-track{width:32px;height:18px;border-radius:9px;background:var(--bg-surface);border:1px solid var(--border-md);position:relative;}
.tog-thumb{position:absolute;top:2px;width:12px;height:12px;border-radius:50%;background:var(--accent);transition:left 0.2s ease;box-shadow:0 1px 3px rgba(0,0,0,0.3);}

/* Modal */
.modal-overlay{position:fixed;inset:0;background:var(--overlay);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;backdrop-filter:blur(6px);animation:fadeIn 0.15s ease;}
.modal{background:var(--bg-card);border:1px solid var(--border-md);border-radius:18px;box-shadow:var(--shadow-lg);width:100%;max-width:460px;animation:scaleIn 0.2s ease;overflow:hidden;}
.modal-hdr{padding:20px 22px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.modal-body{padding:20px 22px;}
.modal-ftr{padding:16px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;background:var(--bg-surface);}
.modal-close{background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;padding:2px;line-height:1;transition:color 0.12s;}
.modal-close:hover{color:var(--text-primary);}

.flex-center{display:flex;align-items:center;justify-content:center;}
`;

/* ─── Constants ─────────────────────────────────────────────────────────── */
const ROUND_COLORS    = ["#6366f1","#10b981","#f59e0b","#ec4899","#06b6d4","#8b5cf6"];
const CAT_ICONS       = { food:"🍛", drink:"🥤", dessert:"🍰", snack:"🍿", beverage:"🥤", appetizer:"🥗" };
const getRoundLabel   = i => ["Round 1","Round 2","Round 3","Round 4","Round 5","Round 6"][i] ?? `Round ${i+1}`;
const getRoundOrdinal = i => ["1st","2nd","3rd","4th","5th","6th"][i] ?? `${i+1}th`;
const catIcon         = cat => CAT_ICONS[cat?.toLowerCase()] || "🍽️";

/* ─── Highlight helper ───────────────────────────────────────────────────── */
function Hl({ text = "", q = "" }) {
  if (!q) return <>{text}</>;
  const lo = text.toLowerCase(), qi = lo.indexOf(q.toLowerCase());
  if (qi === -1) return <>{text}</>;
  return <>{text.slice(0, qi)}<mark>{text.slice(qi, qi + q.length)}</mark>{text.slice(qi + q.length)}</>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function WaiterPanel() {
  /* core state */
  const [tables,           setTables]           = useState([]);
  const [menu,             setMenu]             = useState([]);
  const [specials,         setSpecials]         = useState({});
  const [selectedTable,    setSelectedTable]    = useState(null);
  const [allRounds,        setAllRounds]        = useState([]);
  const [draftRoundIdx,    setDraftRoundIdx]    = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [roundLoading,     setRoundLoading]     = useState(false);
  const [view,             setView]             = useState("tables");
  const [confirmModal,     setConfirmModal]     = useState(false);
  const [confirming,       setConfirming]       = useState(false);
  const [activeOrderType,  setActiveOrderType]  = useState("table");
  const [taxSettings,      setTaxSettings]      = useState(null);
  const [localTheme,       setLocalTheme]       = useState("light");

  /* menu filter */
  const [searchQuery,    setSearchQuery]    = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSubcat,   setActiveSubcat]   = useState("All");

  const { user, logout } = useAuth();
  const navigate   = useNavigate();
  const summaryRef = useRef(null);
  const styleRef   = useRef(null);

  /* inject styles */
  useEffect(() => {
    if (!styleRef.current) {
      const el = document.createElement("style");
      el.textContent = GLOBAL_STYLES;
      document.head.appendChild(el);
      styleRef.current = el;
    }
    return () => { styleRef.current?.remove(); styleRef.current = null; };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", localTheme);
  }, [localTheme]);

  /* ── data ── */
  const loadData = useCallback(async () => {
    try {
      const [t, m, s, tax] = await Promise.all([
        API.get("/tables"), API.get("/menu"),
        API.get("/extras/specials"), API.get("/extras/tax-settings"),
      ]);
      setTables(t.data);
      setMenu(m.data.filter(i => i.is_available));
      const sMap = {};
      s.data.forEach(sp => {
        sMap[sp.menu_id] = { ...sp, discounted_price: sp.discount_pct > 0 ? Math.round(sp.price * (1 - sp.discount_pct / 100)) : sp.price };
      });
      setSpecials(sMap);
      setTaxSettings(tax.data);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const loadTableRounds = useCallback(async (table) => {
    setRoundLoading(true);
    try {
      const res = await API.get(`/orders/table/${table.id}/all`);
      const orders = res.data || [];
      if (!orders.length) { setAllRounds([]); setDraftRoundIdx(null); setRoundLoading(false); return; }
      const rounds = await Promise.all(orders.map(async (order, idx) => {
        try { const d = await API.get(`/orders/${order.id}`); return { order: d.data.order, items: d.data.items || [], roundNumber: idx + 1 }; }
        catch { return { order, items: [], roundNumber: idx + 1 }; }
      }));
      setAllRounds(rounds);
      const di = rounds.findIndex(r => r.order.status === "draft");
      setDraftRoundIdx(di === -1 ? null : di);
    } catch {}
    setRoundLoading(false);
  }, []);

  const refreshRound = async (idx) => {
    const round = allRounds[idx]; if (!round) return;
    try {
      const d = await API.get(`/orders/${round.order.id}`);
      setAllRounds(prev => { const u = [...prev]; u[idx] = { ...u[idx], order: d.data.order, items: d.data.items || [] }; return u; });
    } catch {}
  };

  /* ── actions ── */
  const resetFilter = () => { setSearchQuery(""); setActiveCategory("All"); setActiveSubcat("All"); };

  const selectTable = async (table) => {
    setSelectedTable(table); setActiveOrderType("table"); setView("order"); resetFilter();
    await loadTableRounds(table);
  };

  const startOrder = async () => {
    if (!selectedTable) return;
    setRoundLoading(true);
    try {
      const res = await API.post("/orders", { table_id: selectedTable.id, order_type: "table" });
      setAllRounds([{ order: res.data, items: [], roundNumber: 1 }]); setDraftRoundIdx(0); await loadData();
    } catch (err) { if (err.response?.data?.order_id) await loadTableRounds(selectedTable); }
    setRoundLoading(false);
  };

  const startNewRound = async () => {
    if (!selectedTable || allRounds.some(r => r.order.status === "draft")) return;
    setRoundLoading(true);
    try {
      const res = await API.post("/orders", { table_id: selectedTable.id, order_type: "table", addendum: true });
      setAllRounds(prev => [...prev, { order: res.data, items: [], roundNumber: prev.length + 1 }]);
      setDraftRoundIdx(allRounds.length);
      setTimeout(() => summaryRef.current?.scrollTo({ top: summaryRef.current.scrollHeight, behavior: "smooth" }), 200);
    } catch {}
    setRoundLoading(false);
  };

  const startTableTakeaway = async () => {
    if (!selectedTable || allRounds.some(r => r.order.status === "draft")) return;
    setRoundLoading(true);
    try {
      const res = await API.post("/orders", { table_id: selectedTable.id, order_type: "takeaway" });
      const newIdx = allRounds.length;
      setAllRounds(prev => [...prev, { order: res.data, items: [], roundNumber: prev.length + 1 }]);
      setDraftRoundIdx(newIdx);
      setTimeout(() => summaryRef.current?.scrollTo({ top: summaryRef.current.scrollHeight, behavior: "smooth" }), 200);
    } catch {}
    setRoundLoading(false);
  };

  const startTakeaway = async () => {
    setRoundLoading(true);
    try {
      const res = await API.post("/orders", { order_type: "takeaway" });
      setAllRounds([{ order: res.data, items: [], roundNumber: 1 }]);
      setDraftRoundIdx(0); setSelectedTable(null); setActiveOrderType("takeaway");
    } catch {}
    setRoundLoading(false); setView("order"); resetFilter();
  };

  const addItem = async (menuItem) => {
    if (draftRoundIdx === null) return;
    const dr = allRounds[draftRoundIdx]; if (!dr || dr.order.status !== "draft") return;
    const special = specials[menuItem.id];
    try {
      await API.post(`/orders/${dr.order.id}/items`, { menu_id: menuItem.id, quantity: 1, unit_price: special ? special.discounted_price : menuItem.price });
      await refreshRound(draftRoundIdx);
    } catch {}
  };

  const removeItem = async (itemId) => {
    if (draftRoundIdx === null) return;
    const dr = allRounds[draftRoundIdx]; if (!dr || dr.order.status !== "draft") return;
    try { await API.delete(`/orders/${dr.order.id}/items/${itemId}`); await refreshRound(draftRoundIdx); } catch {}
  };

  const handleSendToKitchen = async () => {
    if (draftRoundIdx === null) return;
    const dr = allRounds[draftRoundIdx]; if (!dr || !dr.items.length) return;
    setConfirming(true);
    try { await API.put(`/orders/${dr.order.id}/confirm`); await refreshRound(draftRoundIdx); setDraftRoundIdx(null); setConfirmModal(false); await loadData(); } catch {}
    setConfirming(false);
  };

  const handleLogout = async () => { try { await API.post("/auth/logout"); } catch {} logout(); navigate("/"); };
  const goBack = () => { setView("tables"); setAllRounds([]); setDraftRoundIdx(null); setSelectedTable(null); loadData(); resetFilter(); };

  /* ── derived menu data ── */
  const categories = useMemo(() => [...new Set(menu.map(m => m.category).filter(Boolean))], [menu]);

  const subcategories = useMemo(() => {
    if (activeCategory === "All") return [];
    return [...new Set(menu.filter(m => m.category === activeCategory).map(m => m.subcategory).filter(Boolean))];
  }, [menu, activeCategory]);

  const handleCatClick = (cat) => { setActiveCategory(cat); setActiveSubcat("All"); setSearchQuery(""); };
  const handleSubClick = (sub) => { setActiveSubcat(sub); setSearchQuery(""); };

  /* filtered + grouped items */
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) return menu.filter(m => m.name.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q) || m.subcategory?.toLowerCase().includes(q));
    let items = menu;
    if (activeCategory !== "All") {
      items = items.filter(m => m.category === activeCategory);
      if (activeSubcat !== "All") items = items.filter(m => m.subcategory === activeSubcat);
    }
    return items;
  }, [menu, searchQuery, activeCategory, activeSubcat]);

  /* group: { [category]: { [subcategory|"__"]: item[] } } */
  const grouped = useMemo(() => {
    const out = {};
    filteredItems.forEach(item => {
      const cat = item.category || "Other";
      const sub = item.subcategory || "__";
      if (!out[cat]) out[cat] = {};
      if (!out[cat][sub]) out[cat][sub] = [];
      out[cat][sub].push(item);
    });
    return out;
  }, [filteredItems]);

  /* totals */
  const combinedTotal = allRounds.reduce((s, r) => s + Number(r.order?.total || 0), 0);
  const taxRate       = taxSettings ? parseFloat(taxSettings.tax_rate) || 13 : 13;
  const taxEnabled    = taxSettings ? taxSettings.tax_enabled !== false : false;
  const taxAmount     = taxEnabled ? parseFloat((combinedTotal * taxRate / 100).toFixed(2)) : 0;
  const grandTotal    = parseFloat((combinedTotal + taxAmount).toFixed(2));
  const hasSentRounds = allRounds.some(r => r.order.status !== "draft");
  const draftRound    = draftRoundIdx !== null ? allRounds[draftRoundIdx] : null;
  const canAddItems   = draftRound !== null && draftRound.order.status === "draft";
  const sentCount     = allRounds.filter(r => r.order.status !== "draft").length;

  const isSearching   = searchQuery.trim().length > 0;
  const showAllCats   = activeCategory === "All" || isSearching;

  /* ─── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-base)", display:"flex", flexDirection:"column", fontFamily:"var(--font)", color:"var(--text-primary)", transition:"background 0.3s,color 0.3s" }}>

      {/* ══ HEADER ═══════════════════════════════════════════════════════ */}
      <header style={{ background:"var(--sidebar-bg)", borderBottom:"1px solid var(--border)", padding:"0 24px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:200, boxShadow:"var(--shadow-sm)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {view === "order" && <button className="btn btn-ghost btn-sm" onClick={goBack} style={{ padding:"6px 12px" }}>← Back</button>}
          <div style={{ width:36, height:36, borderRadius:10, background:"var(--gradient-brand)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>🧑‍🍽️</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, letterSpacing:"-0.02em" }}>Waiter Panel</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", fontWeight:500 }}>{user?.restaurant_name} · {user?.name}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button className="theme-btn" onClick={() => setLocalTheme(t => t==="dark"?"light":"dark")}>
            <span style={{ fontSize:14 }}>{localTheme==="dark"?"🌙":"☀️"}</span>
            <div className="tog-track"><div className="tog-thumb" style={{ left:localTheme==="dark"?"16px":"2px" }} /></div>
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ padding:"7px 11px" }}>🚪</button>
        </div>
      </header>

      <div style={{ flex:1, overflow:"auto", padding:"20px 22px" }}>

        {/* ═══ TABLES VIEW ═════════════════════════════════════════════ */}
        {view === "tables" && (
          <div style={{ maxWidth:1200, margin:"0 auto", animation:"fadeIn 0.25s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22, flexWrap:"wrap", gap:12 }}>
              <div>
                <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.03em" }}>Floor Plan</h1>
                <p style={{ fontSize:13, color:"var(--text-muted)", marginTop:2 }}>Select a table to start or view an order</p>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-primary" onClick={startTakeaway}>📦 New Takeaway</button>
                <button className="btn btn-secondary btn-sm" onClick={loadData}>↻ Refresh</button>
              </div>
            </div>

            {Object.keys(specials).length > 0 && (
              <div style={{ background:"var(--accent-bg)", border:"1px solid var(--accent-border)", borderRadius:14, padding:"13px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <span>⭐</span>
                <span style={{ fontWeight:800, color:"var(--accent)", fontSize:13 }}>Today's Specials</span>
                {Object.values(specials).map((sp, i) => (
                  <span key={i} style={{ background:"var(--accent)", color:"#fff", borderRadius:20, padding:"3px 12px", fontSize:12, fontWeight:700 }}>
                    {sp.name} — Rs.{sp.discounted_price}{sp.discount_pct > 0 && ` (${sp.discount_pct}% off)`}
                  </span>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex-center" style={{ padding:80 }}><div className="spinner" /></div>
            ) : (
              <div className="table-grid">
                {tables.map((t, i) => (
                  <div key={t.id} className={`table-tile ${t.status}`} onClick={() => selectTable(t)} style={{ animationDelay:`${i*0.03}s` }}>
                    <div className="tile-num">T{t.table_number}</div>
                    <div className={`tile-status tile-s-${t.status}`}>{t.status}</div>
                    {t.status === "reserved" && t.reserved_by_name && <div style={{ fontSize:11, color:"#8b5cf6", marginTop:5, fontWeight:600 }}>📋 {t.reserved_by_name}</div>}
                    <div className="tile-cap">👥 {t.capacity}</div>
                  </div>
                ))}
                {tables.length === 0 && (
                  <div style={{ gridColumn:"1/-1", padding:"60px 20px", textAlign:"center", color:"var(--text-muted)" }}>
                    <div style={{ fontSize:48, marginBottom:12 }}>🪑</div>
                    <div style={{ fontWeight:700 }}>No tables configured</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ ORDER VIEW ══════════════════════════════════════════════ */}
        {view === "order" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 382px", gap:20, maxWidth:1280, margin:"0 auto", animation:"fadeIn 0.25s ease" }}>

            {/* ╔══ LEFT: MENU ══╗ */}
            <div style={{ minWidth:0 }}>

              {/* Status badges */}
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:16 }}>
                {activeOrderType === "takeaway"
                  ? <div style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", borderRadius:10, padding:"8px 16px", fontWeight:800, fontSize:14 }}>📦 Takeaway Order</div>
                  : <div style={{ background:"var(--gradient-brand)", color:"#fff", borderRadius:10, padding:"8px 16px", fontWeight:800, fontSize:14 }}>🪑 Table {selectedTable?.table_number}</div>
                }
                {allRounds.map((r, idx) =>
                  r.order.status !== "draft" && (
                    <span key={idx} className="badge" style={{ background:`${ROUND_COLORS[idx%6]}18`, color:ROUND_COLORS[idx%6], border:`1px solid ${ROUND_COLORS[idx%6]}35` }}>
                      ✓ {getRoundLabel(idx)} sent
                    </span>
                  )
                )}
                {draftRoundIdx !== null && <span className="badge badge-warning">✏️ {getRoundOrdinal(draftRoundIdx)} order</span>}
              </div>

              {/* No order started yet */}
              {roundLoading ? (
                <div className="flex-center" style={{ padding:80 }}><div className="spinner" /></div>
              ) : allRounds.length === 0 ? (
                <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:16, padding:50, textAlign:"center" }}>
                  <div style={{ fontSize:52, marginBottom:14 }}>{activeOrderType==="takeaway"?"📦":"🪑"}</div>
                  <div style={{ fontWeight:700, fontSize:17, marginBottom:8 }}>
                    {activeOrderType==="takeaway" ? "New Takeaway Order" : `Table ${selectedTable?.table_number} is free`}
                  </div>
                  <p style={{ color:"var(--text-muted)", fontSize:13, marginBottom:20 }}>
                    {activeOrderType==="table" ? "Click below to begin taking this table's order." : "Items will appear in the summary panel."}
                  </p>
                  {activeOrderType==="table" && <button className="btn btn-primary" onClick={startOrder}>🍽️ Start New Order</button>}
                </div>
              ) : (
                <>
                  {/* Add new round prompt */}
                  {hasSentRounds && draftRoundIdx === null && activeOrderType !== "takeaway" && (
                    <div style={{ background:"var(--bg-card)", border:"1px solid var(--accent-border)", borderRadius:12, padding:"13px 18px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>Need more items?</div>
                        <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>Only new items from this round go to kitchen.</div>
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="btn btn-primary btn-sm" onClick={startNewRound}>➕ {getRoundOrdinal(allRounds.length)} Round</button>
                        <button className="btn btn-secondary btn-sm" onClick={startTableTakeaway}>📦 Takeaway</button>
                      </div>
                    </div>
                  )}

                  {/* ════ SEARCH BAR ════ */}
                  <div style={{ marginBottom:10 }}>
                    <div className="search-wrap">
                      <span className="search-icon">🔍</span>
                      <input
                        className="search-input"
                        type="text"
                        placeholder="Search items, categories, sub-categories…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && <button className="search-clear" onClick={() => setSearchQuery("")}>✕</button>}
                    </div>
                  </div>

                  {/* ════ CATEGORY PILLS ════ */}
                  {!isSearching && (
                    <div style={{ animation:"slideDown 0.18s ease" }}>
                      <div className="cat-nav" style={{ marginBottom:8 }}>
                        {/* All */}
                        <button className={`cat-pill${activeCategory==="All"?" active":""}`} onClick={() => handleCatClick("All")}>
                          🍽️ All
                          <span style={{ fontSize:10, fontWeight:700, background:"rgba(255,255,255,0.1)", borderRadius:8, padding:"1px 6px", marginLeft:2 }}>{menu.length}</span>
                        </button>
                        {categories.map(cat => (
                          <button key={cat} className={`cat-pill${activeCategory===cat?" active":""}`} onClick={() => handleCatClick(cat)}>
                            {catIcon(cat)} {cat.charAt(0).toUpperCase()+cat.slice(1)}
                            <span style={{ fontSize:10, fontWeight:700, background:"rgba(255,255,255,0.1)", borderRadius:8, padding:"1px 6px", marginLeft:2 }}>
                              {menu.filter(m => m.category===cat).length}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* ════ SUBCATEGORY PILLS ════ */}
                      {activeCategory !== "All" && subcategories.length > 0 && (
                        <div style={{ animation:"slideDown 0.16s ease", marginBottom:14 }}>
                          <div className="sub-nav">
                            <button className={`sub-pill${activeSubcat==="All"?" active":""}`} onClick={() => handleSubClick("All")}>
                              All {activeCategory.charAt(0).toUpperCase()+activeCategory.slice(1)}
                            </button>
                            {subcategories.map(sub => (
                              <button key={sub} className={`sub-pill${activeSubcat===sub?" active":""}`} onClick={() => handleSubClick(sub)}>
                                {sub}
                                <span style={{ opacity:0.6, fontSize:10 }}> ({menu.filter(m=>m.category===activeCategory&&m.subcategory===sub).length})</span>
                              </button>
                            ))}
                          </div>
                          {/* divider */}
                          <div style={{ height:1, background:"var(--border)", marginTop:12 }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Search result label */}
                  {isSearching && (
                    <div style={{ marginBottom:12, display:"flex", alignItems:"center", gap:6, animation:"slideDown 0.14s ease" }}>
                      <span style={{ fontSize:13, color:"var(--text-muted)" }}>
                        {filteredItems.length === 0
                          ? `No results for "${searchQuery}"`
                          : `${filteredItems.length} result${filteredItems.length!==1?"s":""} for`}
                      </span>
                      {filteredItems.length > 0 && <span style={{ fontSize:13, fontWeight:700, color:"var(--accent)" }}>"{searchQuery}"</span>}
                      <button style={{ marginLeft:"auto", fontSize:12, background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontFamily:"var(--font)", fontWeight:600 }} onClick={() => setSearchQuery("")}>
                        Clear
                      </button>
                    </div>
                  )}

                  {/* ════ MENU ITEMS ════ */}
                  {filteredItems.length === 0 ? (
                    <div style={{ padding:"50px 20px", textAlign:"center", color:"var(--text-muted)" }}>
                      <div style={{ fontSize:40, marginBottom:10 }}>🔍</div>
                      <div style={{ fontWeight:700, marginBottom:4 }}>No items found</div>
                      <div style={{ fontSize:13 }}>Try a different search or browse categories</div>
                    </div>
                  ) : (
                    Object.entries(grouped).map(([cat, subcats]) => (
                      <div key={cat} style={{ marginBottom:28 }}>

                        {/* Category heading — show when browsing All or searching */}
                        {showAllCats && (
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, paddingBottom:10, borderBottom:"2px solid var(--border)" }}>
                            <span style={{ fontSize:20 }}>{catIcon(cat)}</span>
                            <span style={{ fontWeight:800, fontSize:16, letterSpacing:"-0.02em" }}>
                              {cat.charAt(0).toUpperCase()+cat.slice(1)}
                            </span>
                            <span style={{ fontSize:11, color:"var(--text-muted)", background:"var(--bg-hover)", borderRadius:8, padding:"2px 8px", fontWeight:700 }}>
                              {Object.values(subcats).flat().length} items
                            </span>
                          </div>
                        )}

                        {/* Subcategory groups */}
                        {Object.entries(subcats).map(([sub, items]) => (
                          <div key={sub} style={{ marginBottom:18 }}>

                            {/* Subcategory heading (skip for "__") */}
                            {sub !== "__" && (
                              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                                <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--sub-active-text)", display:"inline-block", flexShrink:0 }} />
                                <span style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--sub-active-text)" }}>
                                  {sub}
                                </span>
                                <span style={{ fontSize:10, color:"var(--text-muted)", fontWeight:600 }}>— {items.length} item{items.length!==1?"s":""}</span>
                              </div>
                            )}

                            {/* Cards grid */}
                            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:10 }}>
                              {items.map(item => {
                                const special      = specials[item.id];
                                const displayPrice = special ? special.discounted_price : item.price;
                                return (
                                  <button key={item.id} className={`menu-card${special?" special":""}`} onClick={() => addItem(item)} disabled={!canAddItems}>
                                    {special && (
                                      <div style={{ position:"absolute", top:-1, right:10, background:"var(--accent)", color:"#fff", fontSize:9, fontWeight:800, borderRadius:"0 0 6px 6px", padding:"2px 8px" }}>
                                        {special.label || `${special.discount_pct}% OFF`}
                                      </div>
                                    )}
                                    <div style={{ fontWeight:700, fontSize:13, marginBottom:4, lineHeight:1.35 }}>
                                      <Hl text={item.name} q={searchQuery} />
                                    </div>
                                    {/* show subcategory label when browsing All */}
                                    {item.subcategory && showAllCats && sub === "__" && (
                                      <div style={{ fontSize:10, color:"var(--sub-active-text)", marginBottom:4, fontWeight:600 }}>{item.subcategory}</div>
                                    )}
                                    <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
                                      <span style={{ color:"var(--success)", fontWeight:800, fontSize:14 }}>Rs. {Number(displayPrice).toLocaleString()}</span>
                                      {special && special.discount_pct > 0 && (
                                        <span style={{ textDecoration:"line-through", fontSize:11, color:"var(--text-muted)" }}>Rs. {Number(item.price).toLocaleString()}</span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {/* ╔══ RIGHT: ORDER SUMMARY ══╗ */}
            <div style={{ position:"sticky", top:20, alignSelf:"start" }}>
              <div className="order-panel">
                <div className="order-panel-hdr">
                  <div>
                    <div style={{ fontWeight:800, fontSize:15, letterSpacing:"-0.02em" }}>Order Summary</div>
                    <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2, fontWeight:500 }}>
                      {activeOrderType==="takeaway" ? "📦 Takeaway"
                        : selectedTable ? `Table ${selectedTable.table_number} · ${allRounds.length} round${allRounds.length!==1?"s":""}` : "No active order"}
                    </div>
                  </div>
                  {allRounds.length > 0 && <span className="badge badge-success">{sentCount}/{allRounds.length} sent</span>}
                </div>

                <div ref={summaryRef} style={{ maxHeight:"calc(100vh - 310px)", overflowY:"auto" }}>
                  {allRounds.length === 0 && (
                    <div style={{ padding:"32px 20px", textAlign:"center", color:"var(--text-muted)", fontSize:13 }}>
                      {activeOrderType==="table" ? "Start an order to see items here" : "Add items to the takeaway order"}
                    </div>
                  )}

                  {allRounds.map((round, idx) => {
                    const isSent  = round.order.status !== "draft";
                    const isDraft = round.order.status === "draft";
                    const color   = ROUND_COLORS[idx % 6];
                    return (
                      <div key={round.order.id}>
                        <div style={{ padding:"9px 18px", background:isDraft?`${color}12`:"var(--bg-surface)", borderBottom:"1px solid var(--border)", borderTop:idx>0?"2px solid var(--border)":"none", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:11, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:isDraft?color:"var(--text-muted)" }}>
                            {round.order.order_type === "takeaway" ? "📦 Takeaway" : getRoundLabel(idx)}
                            {isDraft&&<span style={{ fontWeight:500, textTransform:"none", marginLeft:6, fontSize:10 }}>— adding…</span>}
                          </span>
                          {isSent ? <span style={{ fontSize:11, color:"var(--success)", fontWeight:700 }}>✓ Sent</span> : <span style={{ fontSize:11, color, fontWeight:600 }}>Draft</span>}
                        </div>

                        <div>
                          {round.items.length === 0
                            ? <div style={{ padding:"14px 18px", color:"var(--text-muted)", fontSize:12, textAlign:"center" }}>Tap menu items to add</div>
                            : round.items.map(item => (
                              <div key={item.id} className="order-item-row">
                                <div style={{ flex:1 }}>
                                  <div style={{ fontWeight:600, fontSize:13 }}>{item.name}</div>
                                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>×{item.quantity}</div>
                                </div>
                                <span style={{ fontWeight:700, fontSize:13, color:isDraft?color:"var(--success)" }}>Rs. {Number(item.price).toLocaleString()}</span>
                                {isDraft && (
                                  <button onClick={() => removeItem(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--danger)", fontSize:18, padding:"0 2px", lineHeight:1 }}>×</button>
                                )}
                              </div>
                            ))
                          }
                        </div>

                        <div style={{ padding:"7px 18px", display:"flex", justifyContent:"space-between", fontSize:12, borderBottom:"1px solid var(--border)", background:"var(--bg-surface)" }}>
                          <span style={{ color:"var(--text-muted)" }}>{round.order.order_type === "takeaway" ? "📦 Takeaway" : getRoundLabel(idx)} subtotal</span>
                          <span style={{ fontWeight:700, color:isSent?"var(--text-primary)":color }}>Rs. {Number(round.order?.total||0).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {allRounds.length > 0 && (
                  <div className="order-total-bar">
                    {taxEnabled && (
                      <>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--text-muted)", marginBottom:4 }}><span>Subtotal</span><span>Rs. {combinedTotal.toLocaleString()}</span></div>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--text-muted)", marginBottom:8 }}><span>VAT ({taxRate}%)</span><span>Rs. {taxAmount.toLocaleString()}</span></div>
                      </>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:15, letterSpacing:"-0.02em" }}>Grand Total : </div>
                        {taxEnabled && <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:1 }}>VAT inclusive</div>}
                      </div>
                      <span style={{ color:"var(--success)", fontSize:20, fontWeight:900, letterSpacing:"-0.03em" }}>Rs. {grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {draftRound && draftRound.items.length > 0 && (
                  <div style={{ padding:"14px 16px", borderTop:"1px solid var(--border)" }}>
                    <button className="btn btn-primary" style={{ width:"100%", fontWeight:800, fontSize:14, padding:"13px 0", borderRadius:12, background:`linear-gradient(135deg,${ROUND_COLORS[draftRoundIdx%6]},${ROUND_COLORS[(draftRoundIdx+1)%6]})` }} onClick={() => setConfirmModal(true)}>
                      🚀 Send {draftRound?.order.order_type === "takeaway" ? "Takeaway Order" : getRoundLabel(draftRoundIdx)} to Kitchen
                    </button>
                    <div style={{ fontSize:11, color:"var(--text-muted)", textAlign:"center", marginTop:7 }}>Only new items — no duplicates sent</div>
                  </div>
                )}

                {allRounds.length > 0 && draftRoundIdx === null && (
                  <div style={{ padding:"14px 16px", borderTop:"1px solid var(--border)" }}>
                    <div style={{ background:"var(--success-bg)", border:"1px solid var(--success-border)", borderRadius:10, padding:"10px 14px", textAlign:"center", color:"var(--success)", fontWeight:700, fontSize:13, marginBottom:10 }}>
                      ✅ All rounds sent to kitchen
                    </div>
                    {activeOrderType !== "takeaway" && (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        <button className="btn btn-secondary" style={{ width:"100%", fontWeight:700, fontSize:13 }} onClick={startNewRound}>➕ Add {getRoundOrdinal(allRounds.length)} Order</button>
                        <button className="btn btn-secondary" style={{ width:"100%", fontWeight:700, fontSize:13 }} onClick={startTableTakeaway}>📦 Add Takeaway to Table</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ CONFIRM MODAL ════════════════════════════════════════════════ */}
      {confirmModal && draftRound && (
        <div className="modal-overlay" onClick={() => setConfirmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:`${ROUND_COLORS[draftRoundIdx%6]}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                  {draftRound?.order.order_type === "takeaway" ? "📦" : draftRoundIdx === 0 ? "🍽️" : "➕"}
                </div>
                <div>
                  <h3 style={{ fontWeight:800, fontSize:16, letterSpacing:"-0.02em" }}>
                    Send {draftRound?.order.order_type === "takeaway" ? "Takeaway Order" : getRoundLabel(draftRoundIdx)} to Kitchen
                  </h3>
                  <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>
                    {draftRound?.order.order_type === "takeaway"
                      ? selectedTable ? `Takeaway — Table ${selectedTable.table_number}` : "Takeaway order"
                      : `Table ${selectedTable?.table_number}`}
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setConfirmModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {draftRoundIdx > 0 && (
                <div style={{ background:"var(--info-bg)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:9, padding:"9px 13px", marginBottom:14, fontSize:12, color:"var(--info)", fontWeight:600 }}>
                  ℹ️ Only these new items will go to the kitchen — previous rounds excluded.
                </div>
              )}
              <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
                <div style={{ padding:"9px 14px", borderBottom:"1px solid var(--border)", fontSize:11, fontWeight:800, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.07em" }}>
                  Items — {getRoundLabel(draftRoundIdx)}
                </div>
                {draftRound.items.map((item, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:i<draftRound.items.length-1?"1px solid var(--border)":"none", fontSize:13 }}>
                    <span style={{ fontWeight:600 }}>{item.name}</span>
                    <span style={{ color:"var(--text-muted)", fontWeight:500 }}>×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-ftr">
              <button className="btn btn-ghost" onClick={() => setConfirmModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ fontWeight:800, minWidth:140 }} onClick={handleSendToKitchen} disabled={confirming}>
                {confirming ? <><span className="spinner-sm" /> Sending…</> : "✅ Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
