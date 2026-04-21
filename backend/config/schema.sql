-- ============================================================
-- Restaurant POS v2 - Enhanced Schema (v3 with Tax Support)
-- ============================================================

-- Super Admins
CREATE TABLE IF NOT EXISTS super_admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Restaurants (multi-tenant)
CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address TEXT,
  phone VARCHAR(30),
  pan_number VARCHAR(20),
  subscription_start DATE NOT NULL,
  subscription_end DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  logo TEXT,
  tax_enabled BOOLEAN DEFAULT true,
  tax_rate DECIMAL(5,2) DEFAULT 13.00,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'waiter', 'cashcounter', 'kitchen')),
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  contact_number VARCHAR(30),
  is_active BOOLEAN DEFAULT true,
  last_mac VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tables
CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  table_number INT NOT NULL,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved')),
  reserved_by_name VARCHAR(100),
  reserved_by_phone VARCHAR(30),
  capacity INT DEFAULT 4,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(restaurant_id, table_number)
);

-- Menu items
CREATE TABLE IF NOT EXISTS menu (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('food', 'drink', 'dessert', 'snack')),
  description TEXT,
  is_available BOOLEAN DEFAULT true,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inventory / stock
CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 0,
  unit VARCHAR(30) DEFAULT 'pcs',
  min_stock DECIMAL(10,2) DEFAULT 10,
  cost_per_unit DECIMAL(10,2) DEFAULT 0,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders  (tax_amount stores tax collected at time of payment)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  table_id INT REFERENCES tables(id),
  waiter_id INT REFERENCES users(id),
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  order_type VARCHAR(20) DEFAULT 'table' CHECK (order_type IN ('table', 'takeaway')),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'preparing', 'served', 'credit_pending', 'paid', 'closed')),
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'online', 'credit', NULL)),
  total DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  menu_id INT REFERENCES menu(id),
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('stock', 'inventory', 'rent', 'electricity', 'internet', 'salary', 'other')),
  expense_type VARCHAR(10) NOT NULL CHECK (expense_type IN ('daily', 'monthly')),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Staff Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  login_time TIMESTAMP DEFAULT NOW(),
  logout_time TIMESTAMP,
  mac_address VARCHAR(50),
  date DATE DEFAULT CURRENT_DATE
);

-- Credit payments
CREATE TABLE IF NOT EXISTS credit_payments (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  deadline DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
  received_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reference_id INT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Daily specials
CREATE TABLE IF NOT EXISTS daily_specials (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_id INT REFERENCES menu(id) ON DELETE CASCADE,
  discount_pct INT DEFAULT 0,
  label VARCHAR(100),
  active_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Waste log
CREATE TABLE IF NOT EXISTS waste_log (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  item_name VARCHAR(100) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(30) DEFAULT 'pcs',
  reason VARCHAR(100),
  estimated_cost DECIMAL(10,2) DEFAULT 0,
  logged_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── SEED DATA ────────────────────────────────────────────────────────────────
INSERT INTO restaurants (name, address, phone, pan_number, subscription_start, subscription_end, tax_enabled, tax_rate)
VALUES (
  'The Grand Kitchen', '123 Main Street, Kathmandu', '+977-1-4567890', '123456789',
  CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', true, 13.00
) ON CONFLICT DO NOTHING;

-- ─── MIGRATION: safe to run on existing DB ───────────────────────────────────
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT true;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 13.00;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS mac_address VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_mac VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;
