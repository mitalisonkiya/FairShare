const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_IN_PRODUCTION_ENV_FILE";

exports.requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Verify user still exists in database
        db.get("SELECT id, name, email FROM users WHERE id = ?", [decoded.id], (err, user) => {
            if (err || !user) {
                return res.status(401).json({ error: "Session invalid or user not found" });
            }
            req.user = user;
            next();
        });
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired session" });
    }
};

// Authorization middleware to ensure user is member or owner of the group
exports.requireGroupAccess = (req, res, next) => {
    const groupId = req.params.groupId || req.params.id || req.body.groupId || req.body.group_id;
    const userId = req.user.id;
    const userEmail = req.user.email.toLowerCase();

    if (!groupId) {
        return res.status(400).json({ error: "Group ID is required" });
    }

    // Check if user is owner of group OR in members list
    db.get(
        `SELECT g.id, g.name, g.owner_id 
         FROM groups g
         LEFT JOIN members m ON m.group_id = g.id
         WHERE g.id = ? AND (g.owner_id = ? OR LOWER(m.email) = ?)`,
        [groupId, userId, userEmail],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: "Internal authorization check failed" });
            }
            if (!row) {
                return res.status(403).json({ error: "Access denied: You are not a member of this group" });
            }
            req.group = row;
            next();
        }
    );
};
