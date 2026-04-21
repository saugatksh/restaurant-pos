import LoginPage from "../LoginPage";
export default function SuperAdminLogin() {
  return <LoginPage
    title="Super Admin" subtitle="Multi-Restaurant Control Center" icon="⚡"
    loginEndpoint="/auth/super-login" redirectTo="/superadmin/dashboard"
    links={[{ label: "Restaurant admin?", to: "/admin/login", linkText: "Admin Login" }]}
  />;
}
