const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "FAIRSHARE_SECRET";

// VERIFY JOIN LINK
router.get("/join/:code", (req, res) => {
    const token = req.params.code;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ valid: true, group_id: decoded.group_id });
    } catch {
        res.json({ valid: false });
    }
});

// JOIN GROUP
router.post("/join-group", (req, res) => {
    const { group_id, name, email } = req.body;

    db.run(
        `INSERT INTO members (group_id, name, email) VALUES (?, ?, ?)`,
        [group_id, name, email],
        (err) => {
            if (err) return res.status(400).json({ error: "Failed joining group" });
            res.json({ status: "ok" });
        }
    );
});

module.exports = router;
