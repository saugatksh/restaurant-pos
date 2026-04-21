/**
 * Seed Script — run once after creating the DB schema:
 *   node backend/scripts/seed.js
 *
 * Creates the super admin account with a properly bcrypt-hashed password.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log("DB PASS:", process.env.DB_PASS);

const pool = require("../config/db");
const bcrypt = require("bcrypt");

async function seed() {
  try {
    console.log("🔐 Hashing super admin password...");
    const hash = await bcrypt.hash("superadmin123", 10);

    await pool.query(
      `INSERT INTO super_admins (name, email, password)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password`,
      ["Super Admin", "superadmin@restopos.com", hash]
    );
    console.log("✅ Super admin seeded successfully.");
    console.log("   Email:    superadmin@restopos.com");
    console.log("   Password: superadmin123");

    // Seed demo restaurant if not exists
    await pool.query(
      `INSERT INTO restaurants (name, address, phone, subscription_start, subscription_end)
       VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year')
       ON CONFLICT DO NOTHING`,
      ["The Grand Kitchen", "NewRoad Street, Kathmandu", "+977-9812345678"]
    );
    console.log("✅ Demo restaurant seeded.");
  } catch (err) {
    console.error("❌ Seed failed:");
    console.error(err); // 👈 full error object
  } finally {
    await pool.end();
  }
}

seed();
