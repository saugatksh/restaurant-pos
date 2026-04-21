import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import SubscriptionInactive from "./SubscriptionInactive";

const ROLE_ROUTES = {
  admin: "/admin/dashboard",
  waiter: "/waiter",
  cashcounter: "/cash-counter/panel",
  kitchen: "/kitchen/panel",
  superadmin: "/superadmin/dashboard",
};

const ROLE_INFO = {
  admin:       { icon: "👔", label: "Admin",        color: "#6366f1" },
  waiter:      { icon: "🧑‍🍽️", label: "Waiter",       color: "#f59e0b" },
  cashcounter: { icon: "💰", label: "Cash Counter", color: "#10b981" },
  kitchen:     { icon: "👨‍🍳", label: "Kitchen Staff",color: "#ef4444" },
  superadmin:  { icon: "⚡", label: "Super Admin",  color: "#8b5cf6" },
};

export default function UnifiedLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // When login returns subscription_inactive, show the inactive screen
  // directly without navigating away (no valid session yet).
  const [inactiveRestaurant, setInactiveRestaurant] = useState(null);

  const { login, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  // If we detected an inactive subscription during login attempt, show that screen
  if (inactiveRestaurant) {
    return <SubscriptionInactive restaurantName={inactiveRestaurant} />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      let mac_address = null;
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel("");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const m = offer.sdp?.match(/([0-9a-f]{2}:){5}[0-9a-f]{2}/i);
        if (m) mac_address = m[0];
        pc.close();
      } catch {}

      const res = await API.post("/auth/login", { username, password, mac_address });
      login(res.data.user, res.data.token);
      navigate(ROLE_ROUTES[res.data.user.role] || "/");
    } catch (err) {
      // subscription_inactive: show the dedicated screen instead of a plain error
      if (err.response?.data?.subscription_inactive) {
        setInactiveRestaurant(err.response?.data?.restaurant_name || username);
        setLoading(false);
        return;
      }
      setError(err.response?.data?.msg || "Login failed. Check your credentials.");
    }
    setLoading(false);
  };

  return (
    <div className="unified-login-root">
      {/* Animated background */}
      <div className="login-bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Theme toggle */}
      <button className="login-theme-btn" onClick={toggleTheme} title="Toggle theme">
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <div className="unified-login-card">
        {/* Brand */}
        <div className="unified-login-brand">
          <div className="brand-badge">
            <span style={{ fontSize: 32 }}>🍽️</span>
          </div>
          <h1 className="brand-title">RestroPOS</h1>
          <p className="brand-sub">Restaurant Management System</p>
        </div>

        <p className="login-hint">Sign in with your username or email</p>

        {error && (
          <div className="login-error-banner">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="unified-login-form">
          <div className="login-field">
            <label>Username / Email</label>
            <div className="login-input-wrap">
              <span className="input-icon">👤</span>
              <input
                type="text"
                placeholder="Enter username or email"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label>Password</label>
            <div className="login-input-wrap">
              <span className="input-icon">🔒</span>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button type="button" className="pass-toggle" onClick={() => setShowPass(v => !v)}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? (
              <><span className="spinner-sm" /> Signing in...</>
            ) : (
              <><span>🔑</span> Sign In</>
            )}
          </button>
        </form>

        <div className="login-footer-note">
          Developed by <a href="https://www.saugatbohara.com.np" target="_blank" rel="noopener noreferrer">SAUGAT BOHARA</a>
        </div>
      </div>
    </div>
  );
}
