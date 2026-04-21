// tableRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

router.get("/", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(
      "SELECT * FROM tables WHERE restaurant_id=$1 ORDER BY table_number", [rid]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { table_number, capacity } = req.body;
    const result = await pool.query(
      "INSERT INTO tables (table_number, capacity, restaurant_id) VALUES ($1,$2,$3) RETURNING *",
      [table_number, capacity || 4, rid]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── EDIT TABLE (number, capacity, status, reservation) ─────────────────────
router.put("/:id", authMiddleware, async (req, res) => {
  const { table_number, capacity, status, reserved_by_name, reserved_by_phone } = req.body;
  const validStatuses = ["available", "occupied", "reserved"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    // If clearing reservation, also clear names
    const clearReservation = status && status !== "reserved";
    const result = await pool.query(
      `UPDATE tables SET
         table_number = COALESCE($1, table_number),
         capacity     = COALESCE($2, capacity),
         status       = COALESCE($3, status),
         reserved_by_name  = CASE WHEN $3='reserved' THEN $4 WHEN $3 IS NOT NULL AND $3!='reserved' THEN NULL ELSE COALESCE($4, reserved_by_name) END,
         reserved_by_phone = CASE WHEN $3='reserved' THEN $5 WHEN $3 IS NOT NULL AND $3!='reserved' THEN NULL ELSE COALESCE($5, reserved_by_phone) END
       WHERE id=$6 AND restaurant_id=$7 RETURNING *`,
      [table_number, capacity, status, reserved_by_name || null, reserved_by_phone || null, req.params.id, req.user.restaurant_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Table not found" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── RESERVE TABLE (admin sets reservation) ──────────────────────────────────
router.post("/:id/reserve", authMiddleware, requireRole("admin", "cashcounter"), async (req, res) => {
  const { reserved_by_name, reserved_by_phone } = req.body;
  if (!reserved_by_name || !reserved_by_phone) {
    return res.status(400).json({ error: "Name and phone are required for reservation" });
  }
  try {
    const result = await pool.query(
      `UPDATE tables SET status='reserved', reserved_by_name=$1, reserved_by_phone=$2
       WHERE id=$3 AND restaurant_id=$4 RETURNING *`,
      [reserved_by_name, reserved_by_phone, req.params.id, req.user.restaurant_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Table not found" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM tables WHERE id=$1 AND restaurant_id=$2",
      [req.params.id, req.user.restaurant_id]);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
