const express = require("express");
const router = express.Router();
const { universalLogin, logout } = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");

// Single unified login endpoint for all roles
router.post("/login", universalLogin);

// Legacy endpoints — still work for backwards compat
router.post("/super-login", universalLogin);

router.post("/logout", authMiddleware, logout);

module.exports = router;
