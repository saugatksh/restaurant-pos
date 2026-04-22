import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api";

export default function LoginPage({ role, title, subtitle, icon, loginEndpoint, redirectTo, links }) {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Best-effort MAC address via WebRTC (browser fingerprint for duplicate-login detection)
      let mac_address = null;
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel("");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const match = offer.sdp?.match(/([0-9a-f]{2}:){5}[0-9a-f]{2}/i);
        if (match) mac_address = match[0];
        pc.close();
      } catch {}

      const payload = loginEndpoint === "/auth/super-login"
        ? { email: form.email, password: form.password }
        : { username: form.username, password: form.password, mac_address };

      const res = await API.post(loginEndpoint, payload);
      login(res.data.user, res.data.token);
      navigate(redirectTo);
    } catch (err) {
      setError(err.response?.data?.msg || "Login failed. Please try again.");
    }
    setLoading(false);
  };

  const isSuperAdmin = loginEndpoint === "/auth/super-login";

  return (
    <div className="login-page">
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
        <button className="theme-toggle" onClick={toggleTheme}>
          <span>{theme === "dark" ? "🌙" : "☀️"}</span>
          <div className="toggle-track"><div className="toggle-thumb" /></div>
          <span style={{ fontSize: 11 }}>{theme === "dark" ? "Dark" : "Light"}</span>
        </button>
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">{icon}</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          {isSuperAdmin ? (
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="superadmin@restopos.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter your username"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                autoComplete="username"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? <><span className="spinner-sm" /> Signing in...</> : `Sign In as ${title}`}
          </button>
        </form>

        {links && links.length > 0 && (
          <div className="login-links">
            {links.map((l, i) => (
              <div key={i} className="login-link">
                {l.label} <Link to={l.to}>{l.linkText}</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}