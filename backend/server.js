// ============================================
//  FAIRSHARE SERVER — HARDENED BACKEND
// ============================================

require("dotenv").config();
const express = require("express");
const path = require("path");

const { securityHeaders, corsHandler } = require("./middleware/security");
const { apiLimiter } = require("./middleware/rateLimiter");
const authRoutes = require("./routes/authRoutes");
const groupRoutes = require("./routes/groupRoutes");
const inviteRoutes = require("./routes/inviteRoutes");

const app = express();

// 1. Security Headers & CORS
app.use(securityHeaders);
app.use(corsHandler);

// 2. Request Body Limit (Anti-DoS)
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

// 3. Global API Rate Limiter
app.use("/api", apiLimiter(150, 60000));

// 4. API Routes
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api", inviteRoutes);

// 5. Static Frontend Serving
app.use(express.static(path.join(__dirname, "..")));

// 6. 404 Route Handler for unmatched API paths
app.use("/api", (req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

// 7. Global Centralized Error Handler (No Stack Trace Leakage)
app.use((err, req, res, next) => {
    // Log minimal message on server without sensitive params
    console.error(`[Error] ${req.method} ${req.path}: ${err.message || "Internal server error"}`);
    
    // Generic sanitized error response to client
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === "production" 
            ? "An error occurred while processing your request" 
            : (err.message || "Internal server error")
    });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`FairShare backend service active on port ${PORT}`);
    });
}

module.exports = app;
