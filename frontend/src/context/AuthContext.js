import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  /**
   * subscriptionInactive: true when the restaurant's is_active=false OR
   * subscription_end has passed. Set either at login time (from authController)
   * or mid-session (from the api.js interceptor dispatching "subscription_inactive").
   * Cleared automatically on logout.
   */
  const [subscriptionInactive, setSubscriptionInactive] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (stored && token) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Listen for subscription_inactive events dispatched by the Axios interceptor.
  // This covers the mid-session expiry case: subscription expires while user is logged in.
  useEffect(() => {
    const handler = () => setSubscriptionInactive(true);
    window.addEventListener("subscription_inactive", handler);
    return () => window.removeEventListener("subscription_inactive", handler);
  }, []);

  const login = useCallback((userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    setSubscriptionInactive(false); // clear any previous inactive state on fresh login
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setSubscriptionInactive(false);
  }, []);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      theme,
      toggleTheme,
      subscriptionInactive,
      setSubscriptionInactive,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
