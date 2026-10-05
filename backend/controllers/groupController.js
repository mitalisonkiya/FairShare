const db = require("../db");

// GET ALL GROUPS (Authenticated user only sees their own groups)
exports.getGroups = (req, res) => {
    const userId = req.user.id;
    const userEmail = req.user.email.toLowerCase();

    db.all(
        `SELECT DISTINCT g.id, g.name, g.owner_id, g.created_at
         FROM groups g
         LEFT JOIN members m ON m.group_id = g.id
         WHERE g.owner_id = ? OR LOWER(m.email) = ?
         ORDER BY g.created_at DESC`,
        [userId, userEmail],
        (err, groups) => {
            if (err) {
                return res.status(500).json({ error: "Failed to load groups" });
            }

            if (!groups || groups.length === 0) {
                return res.json([]);
            }

            // Fetch members & expenses for each authorized group
            const result = [];
            let pending = groups.length;

            groups.forEach((group) => {
                db.all(`SELECT id, name, email FROM members WHERE group_id = ?`, [group.id], (mErr, members) => {
                    db.all(`SELECT id, title, amount, amount_paise, paid_by, paid_by_email, created_at FROM expenses WHERE group_id = ? ORDER BY created_at DESC`, [group.id], (eErr, expenses) => {
                        result.push({
                            ...group,
                            members: members || [],
                            expenses: expenses || []
                        });
                        pending--;
                        if (pending === 0) {
                            res.json(result);
                        }
                    });
                });
            });
        }
    );
};

// GET SINGLE GROUP DETAILS
exports.getGroupById = (req, res) => {
    const group = req.group; // Attached by requireGroupAccess

    db.all(`SELECT id, name, email FROM members WHERE group_id = ?`, [group.id], (mErr, members) => {
        db.all(`SELECT id, title, amount, amount_paise, paid_by, paid_by_email, created_at FROM expenses WHERE group_id = ? ORDER BY created_at DESC`, [group.id], (eErr, expenses) => {
            res.json({
                ...group,
                members: members || [],
                expenses: expenses || []
            });
        });
    });
};

// CREATE GROUP
exports.createGroup = (req, res) => {
    const { name } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;
    const userEmail = req.user.email.toLowerCase();

    db.run(
        `INSERT INTO groups (name, owner_id) VALUES (?, ?)`,
        [name, userId],
        function (err) {
            if (err) {
                return res.status(500).json({ error: "Failed to create group" });
            }

            const groupId = this.lastID;

            // Automatically add creator as the first member
            db.run(
                `INSERT INTO members (group_id, user_id, name, email) VALUES (?, ?, ?, ?)`,
                [groupId, userId, userName, userEmail],
                (memErr) => {
                    if (memErr) {
                        return res.status(500).json({ error: "Group created but failed to attach owner member" });
                    }
                    res.status(201).json({
                        success: true,
                        group: { id: groupId, name, owner_id: userId }
                    });
                }
            );
        }
    );
};

// ADD MEMBER TO GROUP
exports.addMember = (req, res) => {
    const groupId = req.group.id;
    const { name, email } = req.body;
    const lowerEmail = email.toLowerCase().trim();

    db.run(
        `INSERT INTO members (group_id, name, email) VALUES (?, ?, ?)`,
        [groupId, name, lowerEmail],
        function (err) {
            if (err) {
                if (err.message && err.message.includes("UNIQUE")) {
                    return res.status(400).json({ error: "Member is already in this group" });
                }
                return res.status(500).json({ error: "Failed to add member" });
            }
            res.status(201).json({
                success: true,
                member: { id: this.lastID, group_id: groupId, name, email: lowerEmail }
            });
        }
    );
};

// REMOVE MEMBER
exports.removeMember = (req, res) => {
    const groupId = req.group.id;
    const memberId = req.params.memberId;
    const userId = req.user.id;
    const userEmail = req.user.email.toLowerCase();

    // Verify if user is group owner OR the member themselves
    db.get(
        `SELECT m.id, m.email, g.owner_id 
         FROM members m 
         JOIN groups g ON g.id = m.group_id 
         WHERE m.id = ? AND m.group_id = ?`,
        [memberId, groupId],
        (err, row) => {
            if (err || !row) {
                return res.status(404).json({ error: "Member not found" });
            }

            if (row.owner_id !== userId && row.email.toLowerCase() !== userEmail) {
                return res.status(403).json({ error: "You are not authorized to remove this member" });
            }

            db.run(`DELETE FROM members WHERE id = ?`, [memberId], (delErr) => {
                if (delErr) return res.status(500).json({ error: "Failed removing member" });
                res.json({ success: true, message: "Member removed" });
            });
        }
    );
};

// ADD EXPENSE (Stored in integer paise)
exports.addExpense = (req, res) => {
    const groupId = req.group.id;
    const { title, amount, amount_paise, paid_by, paid_by_email } = req.body;
    const payerEmail = (paid_by_email || req.user.email).toLowerCase().trim();
    const payerName = paid_by || req.user.name;

    db.run(
        `INSERT INTO expenses (group_id, title, amount, amount_paise, paid_by, paid_by_email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [groupId, title, amount, amount_paise, payerName, payerEmail],
        function (err) {
            if (err) {
                return res.status(500).json({ error: "Failed to record expense" });
            }
            res.status(201).json({
                success: true,
                expense: {
                    id: this.lastID,
                    group_id: groupId,
                    title,
                    amount,
                    paid_by: payerName,
                    paid_by_email: payerEmail
                }
            });
        }
    );
};

// DELETE EXPENSE
exports.deleteExpense = (req, res) => {
    const groupId = req.group.id;
    const expenseId = req.params.expenseId;
    const userId = req.user.id;
    const userEmail = req.user.email.toLowerCase();

    db.get(
        `SELECT e.id, e.paid_by_email, g.owner_id 
         FROM expenses e 
         JOIN groups g ON g.id = e.group_id 
         WHERE e.id = ? AND e.group_id = ?`,
        [expenseId, groupId],
        (err, row) => {
            if (err || !row) {
                return res.status(404).json({ error: "Expense record not found" });
            }

            // Only expense creator or group owner can delete
            if (row.owner_id !== userId && row.paid_by_email.toLowerCase() !== userEmail) {
                return res.status(403).json({ error: "Not authorized to delete this expense" });
            }

            db.run(`DELETE FROM expenses WHERE id = ?`, [expenseId], (delErr) => {
                if (delErr) return res.status(500).json({ error: "Failed to delete expense" });
                res.json({ success: true, message: "Expense deleted" });
            });
        }
    );
};

// DELETE GROUP (Owner only)
exports.deleteGroup = (req, res) => {
    const groupId = req.group.id;
    const userId = req.user.id;

    if (req.group.owner_id !== userId) {
        return res.status(403).json({ error: "Only the group owner can delete this group" });
    }

    db.run(`DELETE FROM groups WHERE id = ?`, [groupId], function (err) {
        if (err) {
            return res.status(500).json({ error: "Failed to delete group" });
        }
        res.json({ success: true, message: "Group deleted" });
    });
};

// SERVER-SIDE DEBT MINIMIZATION & SETTLEMENT CALCULATION
exports.getSettlement = (req, res) => {
    const groupId = req.group.id;

    db.all(`SELECT id, name, email FROM members WHERE group_id = ?`, [groupId], (mErr, members) => {
        if (mErr || !members || members.length === 0) {
            return res.status(400).json({ error: "Group has no members to settle" });
        }

        db.all(`SELECT amount_paise, paid_by_email FROM expenses WHERE group_id = ?`, [groupId], (eErr, expenses) => {
            if (eErr) return res.status(500).json({ error: "Error loading expenses" });

            const totalsPaidPaise = {};
            members.forEach(m => totalsPaidPaise[m.email.toLowerCase()] = 0);

            let grandTotalPaise = 0;
            (expenses || []).forEach(e => {
                const payer = e.paid_by_email.toLowerCase();
                const p = Number(e.amount_paise || Math.round(e.amount * 100));
                totalsPaidPaise[payer] = (totalsPaidPaise[payer] || 0) + p;
                grandTotalPaise += p;
            });

            const memberCount = members.length;
            const perSharePaise = memberCount ? Math.round(grandTotalPaise / memberCount) : 0;

            const balances = members.map(m => {
                const email = m.email.toLowerCase();
                const paid = totalsPaidPaise[email] || 0;
                const netPaise = paid - perSharePaise;
                return {
                    name: m.name,
                    email: m.email,
                    paid: Number((paid / 100).toFixed(2)),
                    share: Number((perSharePaise / 100).toFixed(2)),
                    balance: Number((netPaise / 100).toFixed(2)),
                    netPaise
                };
            });

            // Graph Minimization Algorithm in Integer Paise
            const creditors = balances.filter(b => b.netPaise > 0).map(b => ({ name: b.name, email: b.email, amount: b.netPaise }));
            const debtors = balances.filter(b => b.netPaise < 0).map(b => ({ name: b.name, email: b.email, amount: -b.netPaise }));

            const transfers = [];
            let i = 0, j = 0;
            while (i < debtors.length && j < creditors.length) {
                const owe = debtors[i].amount;
                const credit = creditors[j].amount;
                const val = Math.min(owe, credit);

                transfers.push({
                    from: debtors[i].name,
                    fromEmail: debtors[i].email,
                    to: creditors[j].name,
                    toEmail: creditors[j].email,
                    amount: Number((val / 100).toFixed(2))
                });

                debtors[i].amount -= val;
                creditors[j].amount -= val;

                if (debtors[i].amount <= 0) i++;
                if (creditors[j].amount <= 0) j++;
            }

            res.json({
                groupId,
                totalSpent: Number((grandTotalPaise / 100).toFixed(2)),
                perMemberShare: Number((perSharePaise / 100).toFixed(2)),
                balances,
                transfers
            });
        });
    });
};
