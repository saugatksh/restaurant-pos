@Copyright-SAUGAT BOHARA
Developed by : SAUGAT BOHARA
Website: www.saugatbohara.com.np

# 🍽️ RestoPOS v2 — Complete Restaurant Management System

A full-stack multi-tenant restaurant POS system with subscription management, kitchen display, income/expenditure tracking, staff attendance, and a beautiful dark/light UI.

---

## ✨ What's New in v2

| Feature | Details |
|---|---|
| 🔐 Super Admin | Controls all restaurants, manages subscriptions |
| 🏪 Multi-Restaurant | Each restaurant has its own isolated data |
| 📅 Subscription Model | Service auto-stops when subscription expires |
| 👨‍🍳 Kitchen Login | Separate kitchen station with live order board |
| 💸 Expense Tracking | Daily (stock/inventory) & monthly (rent, salary, etc.) |
| 💹 Income & Expenditure | Monthly P&L report with profit/loss insights |
| 📋 Staff Attendance | Auto-logs login/logout times per day |
| 🌙 Dark / Light Mode | System-wide theme toggle |
| 🏷️ Username Login | Staff log in with username instead of email |
| 🍳 Kitchen Role | New `kitchen` role separate from waiter/cashcounter |

---

## 🗂️ Project Structure

```
restaurant-system/
├── backend/
│   ├── config/
│   │   ├── db.js              # PostgreSQL connection pool
│   │   └── schema.sql         # Full DB schema (run this first)
│   ├── controllers/
│   │   └── authController.js  # Login, logout, attendance logging
│   ├── middleware/
│   │   └── authMiddleware.js  # JWT auth + role checks + subscription check
│   ├── routes/
│   │   ├── authRoutes.js      # /api/auth
│   │   ├── adminRoutes.js     # /api/admin (expenses, attendance, income)
│   │   ├── superAdminRoutes.js# /api/super-admin
│   │   ├── orderRoutes.js     # /api/orders
│   │   ├── menuRoutes.js      # /api/menu
│   │   ├── tableRoutes.js     # /api/tables
│   │   └── inventoryRoutes.js # /api/inventory
│   ├── server.js
│   └── package.json
│
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── api.js             # Axios instance with JWT interceptor
        ├── Main.js            # Router with all routes
        ├── index.css          # Global styles + CSS variables (dark/light)
        ├── context/
        │   └── AuthContext.js # Auth + theme state
        └── pages/
            ├── LoginPage.js   # Shared login component
            ├── admin/
            │   ├── AdminLogin.js
            │   └── AdminDashboard.js  # Full dashboard with all tabs
            ├── waiter/
            │   ├── WaiterLogin.js
            │   └── WaiterPanel.js
            ├── cashcounter/
            │   ├── CashCounterLogin.js
            │   └── CashCounterPanel.js
            ├── kitchen/
            │   ├── KitchenLogin.js
            │   └── KitchenPanel.js    # Real-time kitchen order board
            └── superadmin/
                ├── SuperAdminLogin.js
                └── SuperAdminDashboard.js
```

---

## 🚀 Setup Guide

### 1. PostgreSQL Database

Create a database and run the schema:

```bash
psql -U postgres
CREATE DATABASE restaurant_pos;
\q

psql -U postgres -d restaurant_pos -f backend/config/schema.sql
```

### 2. Backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurant_pos
DB_USER=postgres
DB_PASS=your_postgres_password
JWT_SECRET=your_super_secret_key_here
```

Start the backend:

```bash
npm run dev      # development (with nodemon)
# or
npm start        # production
```

Backend runs on: **http://localhost:5000**

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on: **http://localhost:3000**

---

## 🔑 Login URLs & Default Credentials

| Role | URL | Email/Username | Password |
|---|---|---|---|
| Super Admin | `/superadmin/login` | `superadmin@restopos.com` | `superadmin123` |
| Admin | `/admin/login` | *(set by Super Admin)* | *(set by Super Admin)* |
| Waiter | `/` | *(set by Admin)* | *(set by Admin)* |
| Kitchen | `/kitchen` | *(set by Admin)* | *(set by Admin)* |
| Cash Counter | `/cash-counter` | *(set by Admin)* | *(set by Admin)* |

> **Note:** Super Admin uses email to login. All other roles use **username**.

---

## 👥 Role & Access Guide

### ⚡ Super Admin
- Create and manage restaurants
- Set subscription start/end dates
- Create admin accounts for each restaurant
- View all restaurants and subscription status
- Disable a restaurant (stops all staff logins)

### 🏠 Admin
After logging in, the **Admin Dashboard** has these tabs:

**Operations:**
- 📊 **Overview** — Sales stats, daily revenue, payment breakdown
- 🧾 **Orders** — View/delete all orders
- 👨‍🍳 **Kitchen Orders** — Same live view as kitchen station

**Management:**
- 🪑 **Tables** — Add/remove tables
- 🍔 **Menu** — Add/edit/delete menu items by category
- 📦 **Inventory** — Stock tracking with low-stock alerts
- 👥 **Staff** — Create waiter/kitchen/cashcounter accounts

**Finance:**
- 💹 **Income & Expenditure** — Monthly P&L report with profit/loss insights and recommendations
- 💸 **Expense Entry** — Add daily expenses (stock, inventory) and monthly expenses (rent, electricity, internet, salary, other)

**HR:**
- 📋 **Attendance** — View staff login/logout times by date

### 👨‍🍳 Kitchen
- Sees all pending and preparing orders
- Click **"Start Preparing"** → status becomes `preparing`
- Click **"Mark Served"** → status becomes `served`, waiter notified
- Auto-refreshes every 8 seconds
- Urgent alert shown for orders waiting more than 15 minutes

### 🧑‍🍽️ Waiter
- View all tables (green = available, red = occupied)
- Select table → start order → add menu items
- Order appears in kitchen automatically

### 💰 Cash Counter
- View all active (served/preparing/pending) orders
- Select order → see itemized bill with 13% tax
- Process payment: Cash or Online/QR

---

## 💰 Expense Categories

| Type | Categories |
|---|---|
| **Daily** | Stock Purchase, Inventory, Other |
| **Monthly** | Land/Rent, Electricity Bill, Internet Bill, Staff Salary, Other |

---

## 📊 Income & Expenditure Report

The **Income & Expenditure** tab shows:
- Total income from paid orders (filtered by month/year)
- Total expenses broken down by category
- Net profit or loss
- Profit margin percentage
- Smart recommendations (e.g. "expenses exceed income", "low order count this month")

---

## 📅 Subscription Model

- Each restaurant has a `subscription_start` and `subscription_end` date
- When the subscription expires, **all staff logins are blocked** with an error message
- Super Admin can extend the subscription end date to renew service
- The Super Admin dashboard shows a warning for restaurants expiring within 30 days

---

## 🌙 Dark / Light Mode

- The theme toggle is available on every login page and in the admin sidebar
- Theme preference is saved to `localStorage` and persists across sessions
- CSS custom properties (`--bg-base`, `--text-primary`, etc.) handle theming throughout

---

## 🔄 API Endpoints Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (all roles except super admin) |
| POST | `/api/auth/super-login` | Super admin login |
| POST | `/api/auth/logout` | Logout (records attendance logout time) |

### Super Admin (`/api/super-admin`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/restaurants` | List all restaurants |
| POST | `/restaurants` | Create restaurant |
| PUT | `/restaurants/:id` | Update/renew subscription |
| DELETE | `/restaurants/:id` | Delete restaurant |
| GET | `/restaurants/:id/admins` | List staff for a restaurant |
| POST | `/restaurants/:id/admins` | Create staff account |

### Admin (`/api/admin`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/stats` | Dashboard stats |
| GET | `/sales` | Daily + by-method sales data |
| GET | `/income-expenditure` | Monthly P&L report |
| GET/POST | `/expenses` | List/add expenses |
| DELETE | `/expenses/:id` | Delete expense |
| GET | `/kitchen` | Live kitchen orders |
| GET | `/orders` | All orders |
| GET | `/attendance` | Staff attendance records |
| GET/POST | `/users` | List/add staff |

### Orders (`/api/orders`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | All orders |
| POST | `/` | Create order |
| GET | `/table/:id` | Active order for a table |
| GET | `/:id` | Order with items |
| POST | `/:id/items` | Add item to order |
| DELETE | `/:id/items/:itemId` | Remove item |
| PUT | `/:id/status` | Update order status |
| PUT | `/:id/pay` | Process payment |
| GET | `/:id/bill` | Get bill with tax |

---

## 🔧 Migrating from v1

1. The `users` table now has a `username` field (unique) and `restaurant_id`
2. Staff now log in with **username** not email
3. The `role` field now includes `kitchen` as a valid option
4. All data tables now have a `restaurant_id` foreign key for multi-tenancy
5. Run the new `schema.sql` on a fresh database (or add the new tables/columns manually if keeping existing data)

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6 |
| Styling | Pure CSS with CSS custom properties (no Tailwind) |
| HTTP Client | Axios |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Auth | JWT (jsonwebtoken) |
| Password Hashing | bcrypt |
