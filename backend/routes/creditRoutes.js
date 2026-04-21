const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

const adminOrCash = [authMiddleware, requireRole("admin", "cashcounter")];

// List all credit payments
router.get("/", ...adminOrCash, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(
      `SELECT cp.*, o.total as order_total, COALESCE(t.table_number::text, 'Takeaway') as table_number
       FROM credit_payments cp
       LEFT JOIN orders o ON cp.order_id = o.id
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE cp.restaurant_id=$1
       ORDER BY cp.status ASC, cp.deadline ASC`,
      [rid]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create credit payment — order becomes 'credit_pending' (NOT paid, NOT in sales yet)
router.post("/", ...adminOrCash, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { order_id, customer_name, customer_phone, amount, deadline, notes } = req.body;
    if (!customer_name || !customer_phone || !deadline)
      return res.status(400).json({ error: "Name, phone and deadline are required" });

    // Mark order as credit_pending — NOT paid, so it won't appear in total sales
    await pool.query(
      "UPDATE orders SET status='credit_pending', payment_method='credit', updated_at=NOW() WHERE id=$1",
      [order_id]
    );

    // Free the table so it can be used again
    const ord = await pool.query("SELECT table_id FROM orders WHERE id=$1", [order_id]);
    if (ord.rows[0]?.table_id) {
      await pool.query("UPDATE tables SET status='available' WHERE id=$1 AND restaurant_id=$2",
        [ord.rows[0].table_id, rid]);
    }

    const result = await pool.query(
      `INSERT INTO credit_payments (order_id, restaurant_id, customer_name, customer_phone, amount, deadline, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [order_id, rid, customer_name, customer_phone, amount, deadline, notes || null]
    );

    // Notify admin
    await pool.query(
      `INSERT INTO notifications (restaurant_id, type, title, message, reference_id)
       VALUES ($1,'credit_due','💳 New Credit Payment',$2,$3)`,
      [rid, `${customer_name} (${customer_phone}) owes Rs. ${amount} — due ${new Date(deadline).toLocaleDateString()}`, result.rows[0].id]
    );

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark credit as received — NOW the order becomes 'paid' and appears in sales/income
router.put("/:id/received", ...adminOrCash, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const credit = await pool.query(
      "SELECT * FROM credit_payments WHERE id=$1 AND restaurant_id=$2",
      [req.params.id, rid]
    );
    if (!credit.rows.length) return res.status(404).json({ error: "Not found" });

    // Update credit record
    const result = await pool.query(
      `UPDATE credit_payments SET status='received', received_at=NOW()
       WHERE id=$1 AND restaurant_id=$2 RETURNING *`,
      [req.params.id, rid]
    );

    // NOW mark the order as 'paid' — this is when it counts toward total sales
    await pool.query(
      "UPDATE orders SET status='paid', updated_at=NOW() WHERE id=$1",
      [credit.rows[0].order_id]
    );

    // Mark related notifications as read
    await pool.query(
      "UPDATE notifications SET is_read=true WHERE reference_id=$1 AND restaurant_id=$2 AND type='credit_due'",
      [req.params.id, rid]
    );

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete credit record
router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    await pool.query("DELETE FROM credit_payments WHERE id=$1 AND restaurant_id=$2",
      [req.params.id, req.user.restaurant_id]);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
