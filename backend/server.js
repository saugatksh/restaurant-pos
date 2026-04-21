const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // large for base64 logos

app.use("/api/auth",        require("./routes/authRoutes"));
app.use("/api/admin",       require("./routes/adminRoutes"));
app.use("/api/super-admin", require("./routes/superAdminRoutes"));
app.use("/api/tables",      require("./routes/tableRoutes"));
app.use("/api/menu",        require("./routes/menuRoutes"));
app.use("/api/inventory",   require("./routes/inventoryRoutes"));
app.use("/api/orders",      require("./routes/orderRoutes"));
app.use("/api/credits",     require("./routes/creditRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/extras",      require("./routes/extrasRoutes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`RestoPOS v2 server running on port ${PORT}`));
