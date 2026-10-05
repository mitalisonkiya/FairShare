// Sanitize input to reject NoSQL operators ($ne, $gt, etc.) and ensure primitive types
exports.sanitizeBody = (req, res, next) => {
    if (req.body && typeof req.body === "object") {
        for (const [key, value] of Object.entries(req.body)) {
            if (typeof value === "object" && value !== null) {
                return res.status(400).json({ error: `Invalid input format for field: ${key}` });
            }
            if (typeof value === "string") {
                // Trim string values
                req.body[key] = value.trim();
            }
        }
    }
    next();
};

// Validate Registration / Signup Payload
exports.validateSignup = (req, res, next) => {
    const { name, email, password } = req.body;

    if (!name || typeof name !== "string" || name.length < 2 || name.length > 80) {
        return res.status(400).json({ error: "Name is required and must be between 2 and 80 characters" });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email) || email.length > 254) {
        return res.status(400).json({ error: "A valid email address is required" });
    }

    // Minimum 10 characters password enforcement
    if (!password || typeof password !== "string" || password.length < 10 || password.length > 128) {
        return res.status(400).json({ error: "Password must be at least 10 characters (max 128)" });
    }

    next();
};

// Validate Login Payload
exports.validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Invalid email or password" });
    }
    next();
};

// Validate Group Creation Payload
exports.validateGroup = (req, res, next) => {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 100) {
        return res.status(400).json({ error: "Group name is required (1 to 100 characters)" });
    }
    next();
};

// Validate Member Payload
exports.validateMember = (req, res, next) => {
    const { name, email } = req.body;
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 80) {
        return res.status(400).json({ error: "Member name is required (max 80 characters)" });
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email)) {
        return res.status(400).json({ error: "A valid member email address is required" });
    }
    next();
};

// Validate Expense Payload & Numbers
exports.validateExpense = (req, res, next) => {
    const { title, amount, paid_by_email } = req.body;

    if (!title || typeof title !== "string" || title.length < 1 || title.length > 140) {
        return res.status(400).json({ error: "Expense title is required (1 to 140 characters)" });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0 || numAmount > 10000000) {
        return res.status(400).json({ error: "Amount must be a positive finite number between 0.01 and 10,000,000" });
    }

    // Convert safely to integer paise/cents (e.g. ₹10.50 -> 1050 paise)
    const amountPaise = Math.round(numAmount * 100);
    req.body.amount_paise = amountPaise;
    req.body.amount = Number((amountPaise / 100).toFixed(2));

    next();
};
