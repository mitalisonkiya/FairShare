const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const { recordFailedLogin, resetFailedLogin } = require("../middleware/rateLimiter");

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_IN_PRODUCTION_ENV_FILE";

// USER SIGNUP
exports.signup = async (req, res) => {
    const { name, email, password } = req.body;
    const lowerEmail = email.toLowerCase();

    try {
        // Hash with 12 rounds
        const hashedPassword = await bcrypt.hash(password, 12);

        db.run(
            `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
            [name, lowerEmail, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message && err.message.includes("UNIQUE")) {
                        return res.status(400).json({ error: "An account with this email already exists" });
                    }
                    return res.status(500).json({ error: "Failed to create account" });
                }

                const userId = this.lastID;
                const token = jwt.sign(
                    { id: userId, email: lowerEmail },
                    JWT_SECRET,
                    { expiresIn: "24h" }
                );

                res.status(201).json({
                    success: true,
                    token,
                    user: { id: userId, name, email: lowerEmail }
                });
            }
        );
    } catch (err) {
        res.status(500).json({ error: "Registration processing error" });
    }
};

// USER LOGIN
exports.login = (req, res) => {
    const { email, password } = req.body;
    const lowerEmail = email.toLowerCase();

    db.get(
        `SELECT id, name, email, password, failed_attempts, locked_until FROM users WHERE email = ?`,
        [lowerEmail],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ error: "Authentication processing error" });
            }

            // Check if account is locked
            const now = Date.now();
            if (user && user.locked_until && user.locked_until > now) {
                const remaining = Math.ceil((user.locked_until - now) / 60000);
                return res.status(429).json({ 
                    error: `Account temporarily locked due to repeated failed logins. Try again in ${remaining} minute(s).` 
                });
            }

            // Unified error message for both non-existent user and wrong password
            const invalidMsg = "Invalid email or password";

            if (!user) {
                recordFailedLogin(req);
                return res.status(400).json({ error: invalidMsg });
            }

            try {
                const match = await bcrypt.compare(password, user.password);
                if (!match) {
                    recordFailedLogin(req);
                    
                    // Increment failed attempts in DB
                    const newFailed = (user.failed_attempts || 0) + 1;
                    let lockTime = 0;
                    if (newFailed >= 5) {
                        lockTime = now + (15 * 60 * 1000); // 15 mins lock
                    }
                    db.run("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?", [newFailed, lockTime, user.id]);

                    return res.status(400).json({ error: invalidMsg });
                }

                // Successful login - reset failed attempts
                resetFailedLogin(req);
                db.run("UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = ?", [user.id]);

                const token = jwt.sign(
                    { id: user.id, email: user.email },
                    JWT_SECRET,
                    { expiresIn: "24h" }
                );

                res.json({
                    success: true,
                    token,
                    user: { id: user.id, name: user.name, email: user.email }
                });
            } catch (cmpErr) {
                res.status(500).json({ error: "Authentication processing error" });
            }
        }
    );
};

// PASSWORD RESET - Request Token (Expires in 15 mins)
exports.requestPasswordReset = (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
    }

    const lowerEmail = email.toLowerCase().trim();
    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + (15 * 60 * 1000); // 15 minutes

    db.run(
        `UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?`,
        [token, expires, lowerEmail],
        function (err) {
            if (err) {
                return res.status(500).json({ error: "Reset processing error" });
            }
            // Always return identical success message to prevent user enumeration
            res.json({ 
                success: true, 
                message: "If an account exists with this email, password reset instructions have been prepared." 
            });
        }
    );
};

// PASSWORD RESET - Finalize (Single use verification)
exports.finalizePasswordReset = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || typeof newPassword !== "string" || newPassword.length < 10) {
        return res.status(400).json({ error: "Valid reset token and password (min 10 chars) are required" });
    }

    const now = Date.now();

    db.get(
        `SELECT id FROM users WHERE reset_token = ? AND reset_expires > ?`,
        [token, now],
        async (err, user) => {
            if (err || !user) {
                return res.status(400).json({ error: "Password reset link is invalid or has expired." });
            }

            try {
                const hashedPassword = await bcrypt.hash(newPassword, 12);
                // Nullify reset token to ensure single-use
                db.run(
                    `UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL, failed_attempts = 0, locked_until = 0 WHERE id = ?`,
                    [hashedPassword, user.id],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({ error: "Failed to update password." });
                        }
                        res.json({ success: true, message: "Password updated successfully. Please log in." });
                    }
                );
            } catch (hashErr) {
                res.status(500).json({ error: "Password update processing error." });
            }
        }
    );
};

// ACCOUNT DELETION (GDPR / Data Privacy compliance)
exports.deleteAccount = (req, res) => {
    const userId = req.user.id;

    db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err) {
        if (err) {
            return res.status(500).json({ error: "Failed to delete account" });
        }
        res.json({ success: true, message: "Account and associated data deleted successfully." });
    });
};
