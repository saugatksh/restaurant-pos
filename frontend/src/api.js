import axios from "axios";

const API = axios.create({
  baseURL: `http://${window.location.hostname}:5000/api`,
  timeout: 10000,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response interceptor:
// 1. Tags offline errors for graceful UI handling.
// 2. When a 403 with subscription_inactive=true is received from any API call,
//    dispatch a custom event so the app can redirect to the SubscriptionInactive screen.
//    This handles the edge case where a subscription expires mid-session.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!navigator.onLine || error.code === "ECONNABORTED" || error.message === "Network Error") {
      error.isOffline = true;
      return Promise.reject(error);
    }

    if (
      error.response?.status === 403 &&
      error.response?.data?.subscription_inactive === true
    ) {
      // Broadcast a window event — AuthContext listens and sets the inactive flag.
      window.dispatchEvent(new CustomEvent("subscription_inactive", {
        detail: { msg: error.response.data.msg },
      }));
    }

    return Promise.reject(error);
  }
);

export default API;
