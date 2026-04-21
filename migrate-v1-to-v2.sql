-- ============================================================
-- RestoPOS v1 → v2 Migration Script
-- Run this ONLY if you have existing v1 data to preserve.
-- Otherwise, use schema.sql directly on a fresh database.
-- ============================================================

-- 1. Create super_admins table
CREATE TABLE IF NOT EXISTS super_admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address TEXT,
  phone VARCHAR(30),
  subscription_start DATE NOT NULL DEFAULT CURRENT_DATE,
  subscription_end DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Insert a default restaurant for existing data
INSERT INTO restaurants (name, address, subscription_start, subscription_end)
VALUES ('My Restaurant', 'Enter Address Here', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year')
ON CONFLICT DO NOTHING;

-- 4. Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'waiter', 'cashcounter', 'kitchen'));

-- 5. Populate username from email for existing users
UPDATE users SET username = SPLIT_PART(email, '@', 1) WHERE username IS NULL;

-- 6. Assign existing users to the default restaurant
UPDATE users SET restaurant_id = (SELECT id FROM restaurants LIMIT 1) WHERE restaurant_id IS NULL;

-- 7. Make username NOT NULL and UNIQUE (after populating)
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);

-- 8. Add restaurant_id to existing tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE menu ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);

-- 9. Assign existing records to the default restaurant
UPDATE tables SET restaurant_id = (SELECT id FROM restaurants LIMIT 1) WHERE restaurant_id IS NULL;
UPDATE menu SET restaurant_id = (SELECT id FROM restaurants LIMIT 1) WHERE restaurant_id IS NULL;
UPDATE inventory SET restaurant_id = (SELECT id FROM restaurants LIMIT 1) WHERE restaurant_id IS NULL;
UPDATE orders SET restaurant_id = (SELECT id FROM restaurants LIMIT 1) WHERE restaurant_id IS NULL;

-- 10. Create expenses table
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

-- 11. Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  login_time TIMESTAMP DEFAULT NOW(),
  logout_time TIMESTAMP,
  date DATE DEFAULT CURRENT_DATE
);

-- 12. Add cost_per_unit to inventory if missing
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(10,2) DEFAULT 0;

-- 13. Seed super admin account with a real bcrypt hash
-- ⚠️  DO NOT insert a hardcoded hash here — it will not match any password.
--     After running this migration, seed the super admin by running:
--
--       node backend/scripts/seed.js
--
--     That script hashes the password at runtime and upserts the row correctly.
--     Credentials after seeding:
--       Email:    superadmin@restopos.com
--       Password: superadmin123

-- Done! Verify your data:
-- SELECT * FROM restaurants;
-- SELECT id, name, username, role, restaurant_id FROM users;

-- ─── v2.1 ADDITIONS ──────────────────────────────────────────────────────────
-- Run these if upgrading from v2.0 to v2.1

-- Restaurant logo (base64 data URL or external URL)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo TEXT;

-- MAC address tracking for duplicate-login detection
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS mac_address VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_mac VARCHAR(50);
