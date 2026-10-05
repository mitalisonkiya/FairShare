const express = require("express");
const router = express.Router();
const { requireAuth, requireGroupAccess } = require("../middleware/auth");
const { apiLimiter } = require("../middleware/rateLimiter");
const { sendEmailInvite } = require("../../utils/email");
const db = require("../db");

// Rate limit email invitations to max 10 per 15 minutes
const inviteLimiter = apiLimiter(10, 15 * 60 * 1000);

router.post("/invite", requireAuth, inviteLimiter, (req, res) => {
    const { email, groupId } = req.body;
    const inviterName = req.user.name;

    if (!email || !groupId) {
        return res.status(400).json({ error: "Recipient email and group ID are required" });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid recipient email address" });
    }

    // Verify inviter is member of the group
    db.get(
        `SELECT g.id, g.name 
         FROM groups g 
         LEFT JOIN members m ON m.group_id = g.id 
         WHERE g.id = ? AND (g.owner_id = ? OR LOWER(m.email) = ?)`,
        [groupId, req.user.id, req.user.email.toLowerCase()],
        async (err, group) => {
            if (err || !group) {
                return res.status(403).json({ error: "You are not authorized to invite members to this group" });
            }

            const joinUrl = `${req.headers.origin || "http://localhost:3000"}/groups.html`;
            const sent = await sendEmailInvite(email, joinUrl);

            if (!sent) {
                return res.status(500).json({ error: "Email delivery failed. Please check SMTP settings." });
            }

            res.json({ success: true, message: "Invitation email dispatched successfully." });
        }
    );
});

module.exports = router;
