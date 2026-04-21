const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/authMiddleware");

// ─── GET ALL ITEMS ───────────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(
      "SELECT * FROM menu WHERE restaurant_id=$1 ORDER BY category, subcategory, name", [rid]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BULK INSERT (The missing link for your CSV upload) ─────────────────────
router.post("/bulk", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  const items = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No data provided" });
  }

  try {
    const values = [];
    // Build a dynamic query: ($1, $2, $3, $4, $5, $6, $7), ($8, $9...)
    const queryPlaceholders = items.map((item, index) => {
      const offset = index * 7;
      values.push(
        item.name,
        item.price,
        item.category,
        item.subcategory || "",
        item.description || "",
        item.is_available !== false,
        rid
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    }).join(", ");

    const query = `
      INSERT INTO menu (name, price, category, subcategory, description, is_available, restaurant_id)
      VALUES ${queryPlaceholders}
      RETURNING *`;

    const result = await pool.query(query, values);
    res.json({ success: true, count: result.rowCount });
  } catch (err) {
    console.error("Bulk Insert Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE SINGLE ITEM ──────────────────────────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { name, price, category, subcategory, description } = req.body;
    const result = await pool.query(
      "INSERT INTO menu (name, price, category, subcategory, description, restaurant_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [name, price, category, subcategory || "", description, rid]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── UPDATE ITEM ─────────────────────────────────────────────────────────────
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { name, price, category, subcategory, description, is_available } = req.body;
    const result = await pool.query(
      "UPDATE menu SET name=$1, price=$2, category=$3, subcategory=$4, description=$5, is_available=$6 WHERE id=$7 AND restaurant_id=$8 RETURNING *",
      [name, price, category, subcategory || "", description, is_available, req.params.id, req.user.restaurant_id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE ITEM ─────────────────────────────────────────────────────────────
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM menu WHERE id=$1 AND restaurant_id=$2",
      [req.params.id, req.user.restaurant_id]);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;