// Extra unique features: Daily Specials, Waste Log, Smart Insights
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");
const adminOnly = [authMiddleware, requireRole("admin")];

// ── DAILY SPECIALS ────────────────────────────────────────────────────────────
router.get("/specials", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(
      `SELECT ds.*, m.name, m.price, m.category, m.description
       FROM daily_specials ds JOIN menu m ON ds.menu_id=m.id
       WHERE ds.restaurant_id=$1 AND ds.active_date=CURRENT_DATE AND ds.is_active=true`,
      [rid]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/specials", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { menu_id, discount_pct, label, active_date } = req.body;
    const result = await pool.query(
      `INSERT INTO daily_specials (restaurant_id, menu_id, discount_pct, label, active_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [rid, menu_id, discount_pct || 0, label || null, active_date || new Date().toISOString().split("T")[0]]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/specials/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM daily_specials WHERE id=$1 AND restaurant_id=$2",
      [req.params.id, req.user.restaurant_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── WASTE LOG ─────────────────────────────────────────────────────────────────
router.get("/waste", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  const { month, year } = req.query;
  try {
    let q = `SELECT * FROM waste_log WHERE restaurant_id=$1`;
    const params = [rid];
    if (month && year) {
      params.push(month, year);
      q += ` AND EXTRACT(MONTH FROM logged_at)=$2 AND EXTRACT(YEAR FROM logged_at)=$3`;
    }
    q += " ORDER BY logged_at DESC, created_at DESC";
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/waste", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { item_name, quantity, unit, reason, estimated_cost, logged_at } = req.body;
    const result = await pool.query(
      `INSERT INTO waste_log (restaurant_id, item_name, quantity, unit, reason, estimated_cost, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [rid, item_name, quantity, unit || "pcs", reason || null, estimated_cost || 0, logged_at || new Date().toISOString().split("T")[0]]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/waste/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM waste_log WHERE id=$1 AND restaurant_id=$2",
      [req.params.id, req.user.restaurant_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SMART INSIGHTS ────────────────────────────────────────────────────────────
router.get("/insights", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const [topItems, peakHours, slowItems, creditPending, wasteTotal] = await Promise.all([
      // Top 5 best selling items this month (only cash/online paid — not pending credit)
      pool.query(`
        SELECT m.name,
               COALESCE(SUM(oi.quantity), 0)::int AS qty_sold,
               COALESCE(SUM(oi.price), 0)::numeric AS revenue
        FROM order_items oi
        JOIN menu m ON oi.menu_id = m.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.restaurant_id = $1
          AND o.status = 'paid'
          AND DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', NOW())
        GROUP BY m.name
        ORDER BY qty_sold DESC
        LIMIT 5
      `, [rid]),

      // Peak hours (orders per hour, last 30 days)
      pool.query(`
        SELECT EXTRACT(HOUR FROM created_at)::int AS hour,
               COUNT(*)::int AS orders
        FROM orders
        WHERE restaurant_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY hour
        ORDER BY orders DESC
        LIMIT 6
      `, [rid]),

      // Slow items — on menu but zero orders this month
      pool.query(`
        SELECT m.name FROM menu m
        WHERE m.restaurant_id = $1
          AND m.is_available = true
          AND m.id NOT IN (
            SELECT DISTINCT oi.menu_id
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.restaurant_id = $1
              AND DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', NOW())
          )
        ORDER BY m.name
        LIMIT 8
      `, [rid]),

      // Pending credit total — explicitly cast to avoid null issues
      pool.query(`
        SELECT COALESCE(SUM(amount), 0)::numeric AS total,
               COUNT(*)::int AS count
        FROM credit_payments
        WHERE restaurant_id = $1 AND status = 'pending'
      `, [rid]),

      // Waste cost this month
      pool.query(`
        SELECT COALESCE(SUM(estimated_cost), 0)::numeric AS total
        FROM waste_log
        WHERE restaurant_id = $1
          AND DATE_TRUNC('month', logged_at::date) = DATE_TRUNC('month', CURRENT_DATE)
      `, [rid]),
    ]);

    res.json({
      top_items:      topItems.rows,
      peak_hours:     peakHours.rows,
      slow_items:     slowItems.rows,
      credit_pending: {
        total: parseFloat(creditPending.rows[0]?.total ?? 0),
        count: parseInt(creditPending.rows[0]?.count ?? 0, 10),
      },
      waste_cost: parseFloat(wasteTotal.rows[0]?.total ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TAX SETTINGS (read-only, all authenticated roles) ─────────────────────────
router.get("/tax-settings", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(
      "SELECT tax_enabled, tax_rate FROM restaurants WHERE id=$1",
      [rid]
    );
    res.json(result.rows[0] || { tax_enabled: true, tax_rate: 13.00 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;