// AdminLogin.js
import LoginPage from "../LoginPage";
export default function AdminLogin() {
  return <LoginPage
    title="Admin" subtitle="Restaurant Management Portal" icon="🏠"
    loginEndpoint="/auth/login" redirectTo="/admin/dashboard"
    links={[
      { label: "Waiter login?", to: "/", linkText: "Go to Waiter" },
      { label: "Kitchen login?", to: "/kitchen", linkText: "Go to Kitchen" },
      { label: "Super Admin?", to: "/superadmin/login", linkText: "Super Admin Portal" },
    ]}
  />;
}
