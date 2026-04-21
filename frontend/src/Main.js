import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import UnifiedLogin from "./pages/UnifiedLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import WaiterPanel from "./pages/waiter/WaiterPanel";
import CashCounterPanel from "./pages/cashcounter/CashCounterPanel";
import KitchenPanel from "./pages/kitchen/KitchenPanel";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SubscriptionInactive from "./pages/SubscriptionInactive";
import { useState, useEffect } from "react";

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setShowBack(true); setTimeout(() => setShowBack(false), 3000); };
    const handleOffline = () => { setIsOnline(false); setShowBack(false); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  if (isOnline && !showBack) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: isOnline ? "#16a34a" : "#dc2626",
      color: "#fff", textAlign: "center", padding: "8px 16px",
      fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      animation: "slideDown 0.3s ease",
    }}>
      {isOnline
        ? <><span>✅</span> Back online — data synced</>
        : <><span>📡</span> Offline mode — showing cached data. Changes will sync when reconnected.</>
      }
    </div>
  );
}

/**
 * ProtectedRoute:
 * - Redirects to login if not authenticated.
 * - Shows SubscriptionInactive screen if subscription is inactive/expired mid-session.
 *   The user's data is never deleted — they just can't use the app until renewed.
 */
function ProtectedRoute({ children, roles }) {
  const { user, loading, subscriptionInactive } = useAuth();

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  // Mid-session expiry: show inactive screen without logging the user out.
  // When Super Admin renews, the user just needs to log in again.
  // Superadmin is never blocked by this.
  if (subscriptionInactive && user.role !== "superadmin") {
    return <SubscriptionInactive restaurantName={user.restaurant_name} />;
  }

  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (user?.role === "admin")       return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === "cashcounter") return <Navigate to="/cash-counter/panel" replace />;
  if (user?.role === "kitchen")     return <Navigate to="/kitchen/panel" replace />;
  if (user?.role === "superadmin")  return <Navigate to="/superadmin/dashboard" replace />;
  if (user?.role === "waiter")      return <Navigate to="/waiter" replace />;
  return <UnifiedLogin />;
}

export default function Main() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflineBanner />
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route path="/waiter" element={
            <ProtectedRoute roles={["waiter"]}><WaiterPanel /></ProtectedRoute>
          } />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/cash-counter/panel" element={
            <ProtectedRoute roles={["cashcounter"]}><CashCounterPanel /></ProtectedRoute>
          } />
          <Route path="/kitchen/panel" element={
            <ProtectedRoute roles={["kitchen"]}><KitchenPanel /></ProtectedRoute>
          } />
          <Route path="/superadmin/dashboard" element={
            <ProtectedRoute roles={["superadmin"]}><SuperAdminDashboard /></ProtectedRoute>
          } />

          {/* Legacy login URLs — redirect to unified login */}
          <Route path="/admin/login" element={<Navigate to="/" replace />} />
          <Route path="/superadmin/login" element={<Navigate to="/" replace />} />
          <Route path="/kitchen" element={<Navigate to="/" replace />} />
          <Route path="/cash-counter" element={<Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
