const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const JWT_SECRET = process.env.JWT_SECRET || "RESTAURANT_SECRET_KEY_V2";

const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ msg: "No token" });
  try {
    req.user = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ msg: "Invalid token" });
  }
};

// Accept multiple roles
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ msg: "Forbidden" });
  next();
};

/**
 * Checks the restaurant's is_active flag in the DB for every protected request.
 * Superadmin is always allowed through.
 * If the restaurant is inactive, returns 403 with subscription_inactive: true
 * so the frontend can show the correct screen instead of a generic error.
 */
const requireActiveSubscription = async (req, res, next) => {
  // Superadmin has no restaurant_id — always allowed
  if (req.user?.role === "superadmin") return next();

  const rid = req.user?.restaurant_id;
  if (!rid) return res.status(403).json({ msg: "No restaurant associated with this account" });

  try {
    const result = await pool.query(
      "SELECT is_active, subscription_end FROM restaurants WHERE id=$1",
      [rid]
    );
    if (!result.rows.length) return res.status(404).json({ msg: "Restaurant not found" });

    const { is_active, subscription_end } = result.rows[0];

    // Auto-deactivate if subscription date has passed (safety net in addition to the cron)
    if (is_active && subscription_end && new Date(subscription_end) < new Date()) {
      await pool.query(
        "UPDATE restaurants SET is_active=false WHERE id=$1",
        [rid]
      );
      return res.status(403).json({
        msg: "Restaurant subscription has expired. Please contact Super Admin to renew.",
        subscription_inactive: true,
      });
    }

    if (!is_active) {
      return res.status(403).json({
        msg: "Restaurant service is currently inactive. Please contact Super Admin to renew your subscription.",
        subscription_inactive: true,
      });
    }

    next();
  } catch (err) {
    console.error("Subscription check error:", err.message);
    res.status(500).json({ msg: "Server error during subscription check" });
  }
};

module.exports = { authMiddleware, requireRole, requireActiveSubscription };
