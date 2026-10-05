const express = require("express");
const router = express.Router();
const { 
    signup, 
    login, 
    requestPasswordReset, 
    finalizePasswordReset, 
    deleteAccount 
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { 
    sanitizeBody, 
    validateSignup, 
    validateLogin 
} = require("../middleware/validate");

// Public Auth Endpoints with Rate Limiting & Validation
router.post("/signup", authLimiter, sanitizeBody, validateSignup, signup);
router.post("/login", authLimiter, sanitizeBody, validateLogin, login);
router.post("/forgot-password", authLimiter, sanitizeBody, requestPasswordReset);
router.post("/reset-password", authLimiter, sanitizeBody, finalizePasswordReset);

// Protected Auth Endpoints
router.delete("/account", requireAuth, deleteAccount);

module.exports = router;
