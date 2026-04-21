const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

const adminOnly = [authMiddleware, requireRole("admin")];

// ─── TAX SETTINGS ────────────────────────────────────────────────────────────
router.get("/settings", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(
      "SELECT tax_enabled, tax_rate, name, address, phone, pan_number, logo FROM restaurants WHERE id=$1",
      [rid]
    );
    res.json(result.rows[0] || { tax_enabled: true, tax_rate: 13.00 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/settings", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { tax_enabled, tax_rate } = req.body;
    const rate = Math.max(0, Math.min(100, parseFloat(tax_rate) || 0));
    await pool.query(
      "UPDATE restaurants SET tax_enabled=$1, tax_rate=$2 WHERE id=$3",
      [tax_enabled !== false, rate, rid]
    );
    res.json({ success: true, tax_enabled: tax_enabled !== false, tax_rate: rate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STATS ────────────────────────────────────────────────────────────────────
router.get("/stats", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const [orders, salesRaw, tables, menuCount, pendingOrders, inventory, taxSettings] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM orders WHERE restaurant_id=$1 AND status != 'closed'", [rid]),
      pool.query(
        "SELECT COALESCE(SUM(total),0) AS subtotal, COALESCE(SUM(tax_amount),0) AS tax, COALESCE(SUM(total - tax_amount),0) AS pretax FROM orders WHERE status='paid' AND restaurant_id=$1",
        [rid]
      ),
      pool.query("SELECT COUNT(*) FILTER (WHERE status='occupied') AS occupied, COUNT(*) AS total FROM tables WHERE restaurant_id=$1", [rid]),
      pool.query("SELECT COUNT(*) FROM menu WHERE is_available=true AND restaurant_id=$1", [rid]),
      pool.query("SELECT COUNT(*) FROM orders WHERE status IN ('pending','preparing') AND restaurant_id=$1", [rid]),
      pool.query("SELECT COUNT(*) FROM inventory WHERE quantity <= min_stock AND restaurant_id=$1", [rid]),
      pool.query("SELECT tax_enabled, tax_rate FROM restaurants WHERE id=$1", [rid]),
    ]);
    const totalSales = parseFloat(salesRaw.rows[0].subtotal); // total col = grand total incl. tax
    const taxCollected = parseFloat(salesRaw.rows[0].tax);
    const subtotal = parseFloat(salesRaw.rows[0].pretax);      // pre-tax subtotal
    res.json({
      total_orders: orders.rows[0].count,
      total_sales: totalSales,
      subtotal,
      tax_collected: taxCollected,
      occupied_tables: tables.rows[0].occupied,
      total_tables: tables.rows[0].total,
      available_menu_items: menuCount.rows[0].count,
      pending_orders: pendingOrders.rows[0].count,
      low_stock_items: inventory.rows[0].count,
      tax_enabled: taxSettings.rows[0]?.tax_enabled,
      tax_rate: taxSettings.rows[0]?.tax_rate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SALES ────────────────────────────────────────────────────────────────────
router.get("/sales", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const daily = await pool.query(`
      SELECT DATE(created_at) as date,
        SUM(total) as revenue,
        COUNT(*) as orders
      FROM orders WHERE status='paid' AND restaurant_id=$1
      GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30
    `, [rid]);
    const byMethod = await pool.query(`
      SELECT payment_method, SUM(total) as total, COUNT(*) as count
      FROM orders WHERE status='paid' AND restaurant_id=$1
      GROUP BY payment_method
    `, [rid]);
    res.json({ daily: daily.rows, by_method: byMethod.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── INCOME & EXPENDITURE REPORT ─────────────────────────────────────────────
router.get("/income-expenditure", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  const { month, year } = req.query;
  try {
    const [income, expenses, totalExpenses, taxSettings] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(total - tax_amount),0) as subtotal,
               COALESCE(SUM(tax_amount),0) as tax_collected,
               COUNT(*) as total_orders
        FROM orders
        WHERE status='paid' AND restaurant_id=$1
          AND EXTRACT(MONTH FROM created_at)=$2
          AND EXTRACT(YEAR FROM created_at)=$3
      `, [rid, month, year]),
      pool.query(`
        SELECT category, expense_type, COALESCE(SUM(amount),0) as total
        FROM expenses
        WHERE restaurant_id=$1
          AND EXTRACT(MONTH FROM expense_date)=$2
          AND EXTRACT(YEAR FROM expense_date)=$3
        GROUP BY category, expense_type
        ORDER BY expense_type, category
      `, [rid, month, year]),
      pool.query(`
        SELECT COALESCE(SUM(amount),0) as total_expenses
        FROM expenses
        WHERE restaurant_id=$1
          AND EXTRACT(MONTH FROM expense_date)=$2
          AND EXTRACT(YEAR FROM expense_date)=$3
      `, [rid, month, year]),
      pool.query("SELECT tax_enabled, tax_rate FROM restaurants WHERE id=$1", [rid]),
    ]);

    const subtotal = parseFloat(income.rows[0].subtotal);
    const taxCollected = parseFloat(income.rows[0].tax_collected);
    const totalIncome = subtotal + taxCollected; // revenue with tax
    const totalExp = parseFloat(totalExpenses.rows[0].total_expenses);
    const netProfit = totalIncome - totalExp;

    res.json({
      month, year,
      income: {
        subtotal,
        tax_collected: taxCollected,
        total: totalIncome,
        orders: income.rows[0].total_orders,
      },
      expenses: expenses.rows,
      total_expenses: totalExp,
      net_profit: netProfit,
      profit_margin: totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0,
      tax_settings: taxSettings.rows[0] || { tax_enabled: true, tax_rate: 13 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EXPENSES ────────────────────────────────────────────────────────────────
router.get("/expenses", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  const { month, year, type } = req.query;
  try {
    let query = `SELECT * FROM expenses WHERE restaurant_id=$1`;
    const params = [rid];
    if (month && year) {
      params.push(month, year);
      query += ` AND EXTRACT(MONTH FROM expense_date)=$${params.length - 1} AND EXTRACT(YEAR FROM expense_date)=$${params.length}`;
    }
    if (type) { params.push(type); query += ` AND expense_type=$${params.length}`; }
    query += " ORDER BY expense_date DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/expenses", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { category, expense_type, description, amount, expense_date } = req.body;
    const result = await pool.query(
      `INSERT INTO expenses (restaurant_id, category, expense_type, description, amount, expense_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [rid, category, expense_type, description, amount, expense_date || new Date()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/expenses/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM expenses WHERE id=$1 AND restaurant_id=$2",
      [req.params.id, req.user.restaurant_id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KITCHEN ORDERS ───────────────────────────────────────────────────────────
router.get("/kitchen", authMiddleware, requireRole("admin", "kitchen"), async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(`
      SELECT o.id, o.status, o.created_at, o.notes, o.order_type,
        COALESCE(t.table_number::text, 'Takeaway') as table_number,
        u.name as waiter_name,
        json_agg(json_build_object(
          'id', oi.id, 'item', m.name, 'quantity', oi.quantity, 'category', m.category
        )) AS items
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN menu m ON oi.menu_id = m.id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE o.status IN ('pending','preparing') AND o.restaurant_id=$1
      GROUP BY o.id, t.table_number, u.name
      ORDER BY o.created_at ASC
    `, [rid]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ALL ORDERS ───────────────────────────────────────────────────────────────
router.get("/orders", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(`
      SELECT o.*, COALESCE(t.table_number::text, 'Takeaway') as table_number, u.name as waiter_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE o.restaurant_id=$1
        AND o.status != 'closed'
      ORDER BY o.id DESC
    `, [rid]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/orders/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM orders WHERE id=$1 AND restaurant_id=$2",
      [req.params.id, req.user.restaurant_id]);
    res.json({ message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────
router.get("/users", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(
      "SELECT id, name, username, email, contact_number, role, is_active, created_at FROM users WHERE restaurant_id=$1 ORDER BY role",
      [rid]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/users", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { name, username, email, password, role, contact_number } = req.body;
    const validRoles = ["waiter", "cashcounter", "kitchen"];
    if (!validRoles.includes(role)) return res.status(400).json({ msg: "Invalid role" });
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, username, email, password, role, restaurant_id, contact_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, username, email, role, contact_number`,
      [name, username, email || null, hashed, role, rid, contact_number || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ msg: "Username already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.put("/users/:id", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { name, username, email, contact_number, role, is_active, password } = req.body;
    const validRoles = ["waiter", "cashcounter", "kitchen"];
    if (role && !validRoles.includes(role)) return res.status(400).json({ msg: "Invalid role" });
    let passwordClause = "";
    const params = [name, username, email || null, contact_number || null, role, is_active, req.params.id, rid];
    if (password && password.trim()) {
      const hashed = await bcrypt.hash(password, 10);
      passwordClause = ", password=$9";
      params.splice(7, 0, hashed);
      params[params.length - 1] = rid;
    }
    const result = await pool.query(
      `UPDATE users SET name=$1, username=$2, email=$3, contact_number=$4, role=$5, is_active=$6${passwordClause}
       WHERE id=$${params.length - 1} AND restaurant_id=$${params.length} AND role!='admin'
       RETURNING id, name, username, email, role, contact_number, is_active`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ msg: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ msg: "Username already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.delete("/users/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id=$1 AND role!='admin' AND restaurant_id=$2",
      [req.params.id, req.user.restaurant_id]);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
router.get("/attendance", ...adminOnly, async (req, res) => {
  const rid = req.user.restaurant_id;
  const { date } = req.query;
  try {
    const result = await pool.query(`
      SELECT a.*, u.name, u.role, u.username, u.last_mac
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.restaurant_id=$1
        AND ($2::date IS NULL OR a.date=$2::date)
      ORDER BY a.login_time DESC
    `, [rid, date || null]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;