const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "RESTAURANT_SECRET_KEY_V2";

// Universal login — detects role from DB (admin, waiter, kitchen, cashcounter, superadmin)
const universalLogin = async (req, res) => {
  try {
    const { username, password, mac_address } = req.body;
    if (!username || !password) return res.status(400).json({ msg: "Username and password required" });

    // Try super admin first (uses email)
    const saResult = await pool.query("SELECT * FROM super_admins WHERE email=$1", [username]);
    if (saResult.rows.length) {
      const sa = saResult.rows[0];
      const valid = await bcrypt.compare(password, sa.password);
      if (!valid) return res.status(400).json({ msg: "Invalid password" });
      const token = jwt.sign({ id: sa.id, role: "superadmin", name: sa.name }, JWT_SECRET, { expiresIn: "12h" });
      return res.json({ token, user: { id: sa.id, name: sa.name, email: username, role: "superadmin" } });
    }

    // Try regular user (username field)
    const userResult = await pool.query(
      `SELECT u.*, r.name as restaurant_name, r.subscription_end, r.is_active as restaurant_active,
              r.logo as restaurant_logo, r.subscription_end as sub_end
       FROM users u
       LEFT JOIN restaurants r ON u.restaurant_id = r.id
       WHERE u.username = $1`,
      [username]
    );

    if (!userResult.rows.length) return res.status(400).json({ msg: "User not found" });
    const user = userResult.rows[0];

    if (!user.is_active) return res.status(403).json({ msg: "Account is disabled" });

    // Check restaurant active status first (is_active flag), then subscription date
    if (!user.restaurant_active) {
      return res.status(403).json({
        msg: "Restaurant service is currently inactive. Contact Super Admin to renew subscription.",
        subscription_inactive: true,
      });
    }
    if (user.subscription_end && new Date(user.subscription_end) < new Date()) {
      return res.status(403).json({
        msg: "Restaurant subscription has expired. Contact Super Admin to renew.",
        subscription_inactive: true,
      });
    }

    // MAC mismatch warning (non-blocking)
    if (mac_address && user.last_mac && user.last_mac !== mac_address) {
      console.warn(`⚠️ MAC mismatch for ${username}: expected ${user.last_mac}, got ${mac_address}`);
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ msg: "Invalid password" });

    if (mac_address) {
      await pool.query("UPDATE users SET last_mac=$1 WHERE id=$2", [mac_address, user.id]);
    }

    // ── Attendance: only insert once per calendar day per user ─────────────
    const existing = await pool.query(
      "SELECT id FROM attendance WHERE user_id=$1 AND date=CURRENT_DATE",
      [user.id]
    );
    if (!existing.rows.length) {
      await pool.query(
        "INSERT INTO attendance (user_id, restaurant_id, date, mac_address) VALUES ($1,$2,CURRENT_DATE,$3)",
        [user.id, user.restaurant_id, mac_address || null]
      );
    }

    // ── Subscription expiry notification (if within 14 days) ───────────────
    if (user.sub_end) {
      const daysLeft = Math.ceil((new Date(user.sub_end) - Date.now()) / 86400000);
      if (daysLeft <= 14 && daysLeft > 0) {
        const already = await pool.query(
          `SELECT id FROM notifications WHERE restaurant_id=$1 AND type='subscription_expiry'
           AND created_at > NOW() - INTERVAL '1 day'`,
          [user.restaurant_id]
        );
        if (!already.rows.length) {
          await pool.query(
            `INSERT INTO notifications (restaurant_id, type, title, message)
             VALUES ($1,'subscription_expiry','⚠️ Subscription Expiring Soon',
             $2)`,
            [user.restaurant_id, `Your subscription expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} on ${new Date(user.sub_end).toLocaleDateString()}. Contact Super Admin to renew.`]
          );
        }
      }
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, restaurant_id: user.restaurant_id, restaurant_name: user.restaurant_name },
      JWT_SECRET, { expiresIn: "12h" }
    );

    res.json({
      token,
      user: {
        id: user.id, name: user.name, username: user.username,
        role: user.role, restaurant_id: user.restaurant_id,
        restaurant_name: user.restaurant_name,
        restaurant_logo: user.restaurant_logo || null,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ msg: "Login error" });
  }
};

// Keep legacy endpoints as aliases
const login = universalLogin;
const superAdminLogin = universalLogin;

// Logout
const logout = async (req, res) => {
  try {
    await pool.query(
      `UPDATE attendance SET logout_time=NOW() WHERE user_id=$1 AND date=CURRENT_DATE AND logout_time IS NULL`,
      [req.user.id]
    );
    res.json({ msg: "Logged out" });
  } catch (err) {
    res.status(500).json({ msg: "Logout error" });
  }
};

module.exports = { login, superAdminLogin, universalLogin, logout };
