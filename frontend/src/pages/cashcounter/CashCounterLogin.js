import LoginPage from "../LoginPage";
export default function CashCounterLogin() {
  return <LoginPage
    title="Cash Counter" subtitle="Payment & Billing Portal" icon="💰"
    loginEndpoint="/auth/login" redirectTo="/cash-counter/panel"
    links={[{ label: "Admin?", to: "/admin/login", linkText: "Admin Login" }]}
  />;
}
