import LoginPage from "../LoginPage";
export default function WaiterLogin() {
  return <LoginPage
    title="Waiter" subtitle="Table Order Management" icon="🧑‍🍽️"
    loginEndpoint="/auth/login" redirectTo="/waiter"
    links={[
      { label: "Admin?", to: "/admin/login", linkText: "Admin Login" },
      { label: "Kitchen?", to: "/kitchen", linkText: "Kitchen Login" },
      { label: "Cash Counter?", to: "/cash-counter", linkText: "Cash Counter Login" },
    ]}
  />;
}
