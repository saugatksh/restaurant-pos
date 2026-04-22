/**
 * SubscriptionInactive.js
 *
 * Shown to any staff/admin user when their restaurant's subscription
 * is expired or is_active=false.
 *
 * - Displayed at login if the API returns subscription_inactive: true
 * - Also displayed if any in-app API call returns 403 + subscription_inactive: true
 *   (handled via the Axios interceptor in api.js)
 *
 * Data is never deleted — this screen is just a gate.
 * Once the Super Admin renews the subscription, the user can log in normally
 * and all previous data (menu, orders, staff, inventory) will be there.
 */

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SubscriptionInactive({ restaurantName }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="subscription-inactive-root">
      <div className="subscription-inactive-card">
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "rgba(239,68,68,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, margin: "0 auto 20px",
        }}>
          🔒
        </div>

        <h2 style={{ margin: "0 0 8px", fontSize: "clamp(18px,4vw,22px)", fontWeight: 700, color: "var(--text-primary)" }}>
          Service Suspended
        </h2>

        {(restaurantName || user?.restaurant_name) && (
          <div style={{
            display: "inline-block",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8, padding: "4px 14px",
            fontSize: 13, color: "var(--text-secondary)",
            marginBottom: 20, fontWeight: 600,
          }}>
            🍽️ {restaurantName || user?.restaurant_name}
          </div>
        )}

        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
          Your restaurant's subscription has expired or been deactivated.
          <br />
          <strong>No data has been lost</strong> — all your menu items, orders,
          staff accounts, and inventory are safely preserved.
        </p>

        <div style={{
          background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.3)",
          borderRadius: 12, padding: "14px 18px",
          marginBottom: 28, textAlign: "left",
          fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>💾 Your data is safe:</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Menu items &amp; pricing</li>
            <li>Order history &amp; records</li>
            <li>Staff accounts &amp; roles</li>
            <li>Inventory &amp; stock levels</li>
            <li>All settings &amp; configurations</li>
          </ul>
          <div style={{ marginTop: 10, fontStyle: "italic" }}>
            Everything will be immediately available once your subscription is renewed.
          </div>
        </div>

        <div style={{
          background: "var(--bg-surface)",
          borderRadius: 10, padding: "14px 18px",
          marginBottom: 28, fontSize: 13, color: "var(--text-muted)",
        }}>
          📞 Please contact your <strong>Super Admin</strong> to renew the subscription
          and restore service access.
        </div>

        <button onClick={handleLogout} className="btn btn-secondary" style={{ width: "100%", justifyContent: "center", padding: "13px" }}>
          ← Back to Login
        </button>
      </div>
    </div>
  );
}