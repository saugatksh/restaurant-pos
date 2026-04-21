const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

const superOnly = [authMiddleware, requireRole("superadmin")];

// ─── RESTAURANTS ─────────────────────────────────────────────────────────────

router.get("/restaurants", ...superOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*,
        (SELECT COUNT(*) FROM users WHERE restaurant_id=r.id AND role='admin') as admin_count,
        (SELECT COUNT(*) FROM users WHERE restaurant_id=r.id) as staff_count
      FROM restaurants r
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/restaurants", ...superOnly, async (req, res) => {
  try {
    const { name, address, phone, pan_number, subscription_start, subscription_end, logo } = req.body;
    const result = await pool.query(
      `INSERT INTO restaurants (name, address, phone, pan_number, subscription_start, subscription_end, logo)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, address, phone, pan_number || null, subscription_start, subscription_end, logo || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/restaurants/:id", ...superOnly, async (req, res) => {
  try {
    const { name, address, phone, pan_number, subscription_start, subscription_end, is_active, logo } = req.body;
    const result = await pool.query(
      `UPDATE restaurants SET name=$1, address=$2, phone=$3, pan_number=$4,
       subscription_start=$5, subscription_end=$6, is_active=$7, logo=$8
       WHERE id=$9 RETURNING *`,
      [name, address, phone, pan_number ?? null, subscription_start, subscription_end, is_active, logo ?? null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * RENEW SUBSCRIPTION
 * Sets a new subscription_start and subscription_end, and automatically
 * sets is_active=true so service resumes immediately with all existing data intact.
 * The restaurant's menu, orders, staff, inventory, etc. are never touched —
 * only the subscription window and active flag change.
 */
router.post("/restaurants/:id/renew", ...superOnly, async (req, res) => {
  try {
    const { subscription_start, subscription_end } = req.body;
    if (!subscription_start || !subscription_end) {
      return res.status(400).json({ error: "subscription_start and subscription_end are required" });
    }
    if (new Date(subscription_end) <= new Date(subscription_start)) {
      return res.status(400).json({ error: "subscription_end must be after subscription_start" });
    }

    const result = await pool.query(
      `UPDATE restaurants
       SET subscription_start = $1,
           subscription_end   = $2,
           is_active          = true
       WHERE id = $3
       RETURNING *`,
      [subscription_start, subscription_end, req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Restaurant not found" });

    // Log renewal as a notification visible to admin
    await pool.query(
      `INSERT INTO notifications (restaurant_id, type, title, message)
       VALUES ($1, 'subscription_renewed', '✅ Subscription Renewed',
       $2)`,
      [
        req.params.id,
        `Subscription renewed from ${new Date(subscription_start).toLocaleDateString()} to ${new Date(subscription_end).toLocaleDateString()}. Service is now active.`,
      ]
    );

    res.json({ message: "Subscription renewed and service reactivated", restaurant: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * SYNC SUBSCRIPTION STATUS
 * Automatically sets is_active=false for all restaurants whose subscription_end
 * has passed. Safe to call from a cron job (e.g., daily at midnight).
 * Data is NEVER deleted — only is_active toggles.
 */
router.post("/sync-subscription-status", ...superOnly, async (req, res) => {
  try {
    const deactivated = await pool.query(
      `UPDATE restaurants
       SET is_active = false
       WHERE subscription_end < CURRENT_DATE
         AND is_active = true
       RETURNING id, name, subscription_end`
    );

    const reactivated = await pool.query(
      `UPDATE restaurants
       SET is_active = true
       WHERE subscription_start <= CURRENT_DATE
         AND subscription_end >= CURRENT_DATE
         AND is_active = false
       RETURNING id, name, subscription_start, subscription_end`
    );

    res.json({
      message: "Subscription status synced",
      deactivated: deactivated.rows,
      reactivated: reactivated.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/restaurants/:id", ...superOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM restaurants WHERE id=$1", [req.params.id]);
    res.json({ message: "Restaurant deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN USER MANAGEMENT ───────────────────────────────────────────────────

router.get("/restaurants/:id/admins", ...superOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, username, email, role, is_active, created_at
       FROM users WHERE restaurant_id=$1 ORDER BY role`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/restaurants/:id/admins", ...superOnly, async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;
    const validRoles = ["admin", "waiter", "cashcounter", "kitchen"];
    if (!validRoles.includes(role)) return res.status(400).json({ msg: "Invalid role" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, username, email, password, role, restaurant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, username, email, role`,
      [name, username, email || null, hashedPassword, role, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ msg: "Username already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.delete("/restaurants/:rid/admins/:uid", ...superOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id=$1 AND restaurant_id=$2", [
      req.params.uid, req.params.rid,
    ]);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SUPER ADMIN STATS ────────────────────────────────────────────────────────

router.get("/stats", ...superOnly, async (req, res) => {
  try {
    const [rests, users, active, inactive] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM restaurants"),
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM restaurants WHERE is_active=true AND subscription_end >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM restaurants WHERE is_active=false OR subscription_end < CURRENT_DATE"),
    ]);
    res.json({
      total_restaurants: rests.rows[0].count,
      total_users: users.rows[0].count,
      active_subscriptions: active.rows[0].count,
      inactive_restaurants: inactive.rows[0].count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

