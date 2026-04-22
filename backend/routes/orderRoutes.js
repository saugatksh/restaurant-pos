const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/authMiddleware");

// Helper: get tax settings for a restaurant
async function getTaxSettings(restaurant_id) {
  const r = await pool.query(
    "SELECT tax_enabled, tax_rate FROM restaurants WHERE id=$1",
    [restaurant_id]
  );
  const row = r.rows[0] || {};
  return {
    tax_enabled: row.tax_enabled !== false,
    tax_rate: parseFloat(row.tax_rate) || 13.0,
  };
}

// LIST ALL ORDERS — includes combined_total for table orders (all rounds summed)
router.get("/", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(`
      SELECT o.*,
        COALESCE(t.table_number::text, 'Takeaway') as table_number,
        u.name as waiter_name,
        CASE
          -- Paid/closed: primary order total already holds grand total (incl. tax)
          WHEN o.status = 'paid' THEN o.total
          -- Closed secondary rounds: not shown (filtered out below)
          WHEN o.status = 'closed' THEN o.total
          -- Active table orders: sum all active rounds for live display
          WHEN o.order_type = 'table' AND o.table_id IS NOT NULL THEN (
            SELECT COALESCE(SUM(o2.total), 0)
            FROM orders o2
            WHERE o2.table_id = o.table_id
              AND o2.restaurant_id = o.restaurant_id
              AND o2.status NOT IN ('paid','closed')
          )
          ELSE o.total
        END as combined_total
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

// GET PRIMARY ACTIVE ORDER FOR A TABLE (oldest non-paid/closed)
router.get("/table/:tableId", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(
      `SELECT o.*, t.table_number FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.table_id=$1 AND o.restaurant_id=$2 AND o.status NOT IN ('paid','closed')
       ORDER BY o.id ASC LIMIT 1`,
      [req.params.tableId, rid]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL ACTIVE ORDERS FOR A TABLE (all rounds, oldest first)
router.get("/table/:tableId/all", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const result = await pool.query(
      `SELECT o.*, t.table_number FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.table_id=$1 AND o.restaurant_id=$2 AND o.status NOT IN ('paid','closed')
       ORDER BY o.id ASC`,
      [req.params.tableId, rid]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE ORDER
router.post("/", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { table_id, order_type, addendum } = req.body;
    const waiter_id = req.user.id;
    const type = order_type || (table_id ? "table" : "takeaway");

    // If not addendum, check for existing draft orders on this table (only count table-type orders, not takeaway)
    if (type === "table" && table_id && !addendum) {
      const existing = await pool.query(
        "SELECT id FROM orders WHERE table_id=$1 AND restaurant_id=$2 AND order_type='table' AND status NOT IN ('paid','closed','credit_pending')",
        [table_id, rid]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Table already has an active order", order_id: existing.rows[0].id });
      }
    }

    const order = await pool.query(
      "INSERT INTO orders (table_id, waiter_id, restaurant_id, status, total, order_type) VALUES ($1,$2,$3,'draft',0,$4) RETURNING *",
      [table_id || null, waiter_id, rid, type]
    );

    if (type === "table" && table_id) {
      await pool.query("UPDATE tables SET status='occupied' WHERE id=$1 AND restaurant_id=$2", [table_id, rid]);
    }

    res.json(order.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ORDER DETAIL (with items)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const order = await pool.query(
      `SELECT o.*, COALESCE(t.table_number::text, 'Takeaway') as table_number, u.name as waiter_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN users u ON o.waiter_id = u.id
       WHERE o.id=$1`,
      [req.params.id]
    );
    const items = await pool.query(
      `SELECT m.name, m.category,
              m.id AS menu_id,
              MIN(oi.id) AS id,
              SUM(oi.quantity) AS quantity,
              SUM(oi.price) AS price
       FROM order_items oi
       JOIN menu m ON oi.menu_id = m.id
       WHERE oi.order_id=$1
       GROUP BY m.name, m.category, m.id
       ORDER BY m.name ASC`,
      [req.params.id]
    );
    res.json({ order: order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD ITEM TO ORDER
router.post("/:orderId/items", authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { menu_id, quantity, unit_price } = req.body;

    let price;
    if (unit_price !== undefined) {
      price = parseFloat(unit_price);
    } else {
      const menuResult = await pool.query("SELECT * FROM menu WHERE id=$1", [menu_id]);
      if (!menuResult.rows.length) return res.status(404).json({ error: "Menu item not found" });
      price = parseFloat(menuResult.rows[0].price);
    }

    const totalPrice = price * parseInt(quantity);
    const item = await pool.query(
      "INSERT INTO order_items (order_id, menu_id, quantity, price) VALUES ($1,$2,$3,$4) RETURNING *",
      [orderId, menu_id, quantity, totalPrice]
    );
    await pool.query("UPDATE orders SET total=total+$1, updated_at=NOW() WHERE id=$2", [totalPrice, orderId]);
    res.json(item.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REMOVE ITEM FROM ORDER
router.delete("/:orderId/items/:itemId", authMiddleware, async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const item = await pool.query("SELECT * FROM order_items WHERE id=$1 AND order_id=$2", [itemId, orderId]);
    if (!item.rows.length) return res.status(404).json({ error: "Item not found" });
    await pool.query("DELETE FROM order_items WHERE id=$1", [itemId]);
    await pool.query("UPDATE orders SET total=total-$1, updated_at=NOW() WHERE id=$2", [item.rows[0].price, orderId]);
    res.json({ message: "Item removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CONFIRM ORDER (draft → pending, visible to kitchen)
router.put("/:id/confirm", authMiddleware, async (req, res) => {
  try {
    const order = await pool.query("SELECT * FROM orders WHERE id=$1", [req.params.id]);
    if (!order.rows.length) return res.status(404).json({ error: "Order not found" });
    if (order.rows[0].status !== "draft") {
      return res.status(400).json({ error: "Order already confirmed" });
    }
    const result = await pool.query(
      "UPDATE orders SET status='pending', updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE STATUS
router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      "UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PAY ORDER — calculates tax, applies discount, stores amounts, marks all rounds paid
router.put("/:id/pay", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const { id } = req.params;
    const { method, discount_amount: rawDiscount } = req.body;

    const orderRes = await pool.query("SELECT * FROM orders WHERE id=$1", [id]);
    if (!orderRes.rows.length) return res.status(404).json({ error: "Order not found" });
    const primaryOrder = orderRes.rows[0];
    if (primaryOrder.status === "paid") return res.status(400).json({ error: "Already paid" });

    // Get tax settings
    const { tax_enabled, tax_rate } = await getTaxSettings(rid);

    // For table orders: gather ALL active rounds to compute combined subtotal
    let allRoundIds = [parseInt(id)];
    let combinedSubtotal = 0;

    if (primaryOrder.table_id) {
      const relatedOrders = await pool.query(
        "SELECT id, total FROM orders WHERE table_id=$1 AND restaurant_id=$2 AND status NOT IN ('paid','closed','credit_pending')",
        [primaryOrder.table_id, rid]
      );
      allRoundIds = relatedOrders.rows.map(r => r.id);
      combinedSubtotal = relatedOrders.rows.reduce((sum, r) => sum + parseFloat(r.total), 0);
    } else {
      combinedSubtotal = parseFloat(primaryOrder.total);
    }

    // Calculate tax on subtotal (discount does NOT reduce tax base)
    const taxAmount = tax_enabled ? parseFloat((combinedSubtotal * tax_rate / 100).toFixed(2)) : 0;
    const totalWithTax = parseFloat((combinedSubtotal + taxAmount).toFixed(2));

    // Discount is applied after tax — clamp to [0, totalWithTax]
    const discountAmount = Math.min(
      Math.max(0, parseFloat(rawDiscount) || 0),
      totalWithTax
    );
    const grandTotal = parseFloat((totalWithTax - discountAmount).toFixed(2));

    // Mark secondary rounds as 'closed' (excluded from stats), primary as 'paid' with grand total
    const secondaryIds = allRoundIds.filter(r2 => r2 !== parseInt(id));
    if (secondaryIds.length > 0) {
      await pool.query(
        `UPDATE orders SET status='closed', payment_method=$1, updated_at=NOW()
         WHERE id = ANY($2::int[]) AND restaurant_id=$3`,
        [method, secondaryIds, rid]
      );
    }

    // Update primary order: store grand total (after discount), tax_amount, discount_amount
    await pool.query(
      `UPDATE orders SET status='paid', payment_method=$1,
        total=$2, tax_amount=$3, discount_amount=$4, updated_at=NOW() WHERE id=$5`,
      [method, grandTotal, taxAmount, discountAmount, parseInt(id)]
    );

    // Free the table
    if (primaryOrder.table_id) {
      await pool.query("UPDATE tables SET status='available' WHERE id=$1 AND restaurant_id=$2",
        [primaryOrder.table_id, rid]);
    }

    res.json({
      message: "Payment successful",
      subtotal: combinedSubtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      grand_total: grandTotal,
      rounds_paid: allRoundIds.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET COMBINED BILL — merges all active rounds for a table, uses restaurant tax settings
router.get("/:id/bill", authMiddleware, async (req, res) => {
  const rid = req.user.restaurant_id;
  try {
    const order = await pool.query(
      `SELECT o.*, COALESCE(t.table_number::text, 'Takeaway') as table_number,
        u.name as waiter_name, r.name as restaurant_name, r.phone as restaurant_phone,
        r.pan_number, r.address as restaurant_address, r.tax_enabled, r.tax_rate
       FROM orders o
       LEFT JOIN tables t ON o.table_id=t.id
       LEFT JOIN users u ON o.waiter_id=u.id
       JOIN restaurants r ON o.restaurant_id=r.id
       WHERE o.id=$1`,
      [req.params.id]
    );

    if (!order.rows.length) return res.status(404).json({ error: "Order not found" });
    const mainOrder = order.rows[0];
    const taxEnabled = mainOrder.tax_enabled !== false;
    const taxRate = parseFloat(mainOrder.tax_rate) || 13.0;

    let allOrderIds = [parseInt(req.params.id)];

    if (mainOrder.table_id) {
      let relatedOrders;

      if (mainOrder.status === "paid") {
        // Receipt view (post-payment): find only the rounds closed in the same
        // payment transaction — they share an updated_at within a 10-second window.
        relatedOrders = await pool.query(
          `SELECT id FROM orders
           WHERE table_id=$1 AND restaurant_id=$2
             AND (
               id = $3
               OR (status = 'closed'
                   AND ABS(EXTRACT(EPOCH FROM (updated_at - $4::timestamptz))) < 10)
             )
           ORDER BY id ASC`,
          [mainOrder.table_id, mainOrder.restaurant_id,
           parseInt(req.params.id), mainOrder.updated_at]
        );
      } else {
        // Live bill view (pre-payment): only include rounds that are still active
        // — never include paid/closed orders from previous sessions.
        relatedOrders = await pool.query(
          `SELECT id FROM orders
           WHERE table_id=$1 AND restaurant_id=$2
             AND status NOT IN ('paid','closed')
           ORDER BY id ASC`,
          [mainOrder.table_id, mainOrder.restaurant_id]
        );
      }

      if (relatedOrders.rows.length > 0) {
        allOrderIds = relatedOrders.rows.map(r => r.id);
      }
    }

    // Fetch items for all rounds, merged by menu item (sum qty + price across rounds)
    const itemsResult = await pool.query(
      `SELECT m.name,
              SUM(oi.quantity) AS quantity,
              SUM(oi.price) AS price
       FROM order_items oi
       JOIN menu m ON oi.menu_id=m.id
       WHERE oi.order_id = ANY($1::int[])
       GROUP BY m.name
       ORDER BY m.name ASC`,
      [allOrderIds]
    );

    const subtotal = itemsResult.rows.reduce((sum, i) => sum + parseFloat(i.price), 0);
    const taxAmount = taxEnabled ? parseFloat((subtotal * taxRate / 100).toFixed(2)) : 0;
    const totalWithTax = parseFloat((subtotal + taxAmount).toFixed(2));

    // If already paid, use the stored discount from the DB (set at pay time)
    const storedDiscount = parseFloat(mainOrder.discount_amount) || 0;
    const total = parseFloat((totalWithTax - storedDiscount).toFixed(2));

    res.json({
      order: mainOrder,
      items: itemsResult.rows,
      allOrderIds,
      roundMap: {},
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax_enabled: taxEnabled,
      tax_rate: taxRate,
      tax: taxAmount,
      discount_amount: storedDiscount,
      total,
      restaurant_name: mainOrder.restaurant_name,
      restaurant_phone: mainOrder.restaurant_phone,
      pan_number: mainOrder.pan_number,
      restaurant_address: mainOrder.restaurant_address,
      waiter_name: mainOrder.waiter_name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;