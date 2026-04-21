const { Pool } = require("pg");
require("dotenv").config({ path: __dirname + "/../.env" }); // ✅ REQUIRED

console.log("Loaded DB_PASS:", process.env.DB_PASS);

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "restaurant_pos",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS, // ✅ remove fallback
});

module.exports = pool;