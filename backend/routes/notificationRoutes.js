const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

// Get unread notifications for admin
router.get("/", authMiddleware, requireRole("admin"), async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    // Auto-generate overdue credit reminders
    const overdue = await pool.query(
      `SELECT cp.* FROM credit_payments cp
       WHERE cp.restaurant_id=$1 AND cp.status='pending' AND cp.deadline < CURRENT_DATE`,
      [rid]
    );
    for (const cp of overdue.rows) {
      const exists = await pool.query(
        `SELECT id FROM notifications WHERE reference_id=$1 AND type='credit_overdue' AND created_at > NOW()-INTERVAL '12 hours'`,
        [cp.id]
      );
      if (!exists.rows.length) {
        await pool.query(
          `INSERT INTO notifications (restaurant_id, type, title, message, reference_id)
           VALUES ($1,'credit_overdue','🔴 Overdue Credit Payment',$2,$3)`,
          [rid, `${cp.customer_name} (${cp.customer_phone}) — Rs. ${cp.amount} was due on ${new Date(cp.deadline).toLocaleDateString()}`, cp.id]
        );
      }
    }

    const result = await pool.query(
      `SELECT * FROM notifications WHERE restaurant_id=$1
       ORDER BY is_read ASC, created_at DESC LIMIT 50`,
      [rid]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id/read", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read=true WHERE id=$1 AND restaurant_id=$2",
      [req.params.id, req.user.restaurant_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/read-all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read=true WHERE restaurant_id=$1",
      [req.user.restaurant_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
