import LoginPage from "../LoginPage";
export default function KitchenLogin() {
  return <LoginPage
    title="Kitchen" subtitle="Order Preparation Station" icon="👨‍🍳"
    loginEndpoint="/auth/login" redirectTo="/kitchen/panel"
    links={[
      { label: "Waiter login?", to: "/", linkText: "Waiter Login" },
      { label: "Admin?", to: "/admin/login", linkText: "Admin Login" },
    ]}
  />;
}
