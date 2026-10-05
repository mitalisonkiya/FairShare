// In-memory sliding window rate limiter
const ipRequests = new Map();
const loginAttempts = new Map();

// General API rate limiter (e.g. max 120 req / minute per IP)
exports.apiLimiter = (maxReq = 120, windowMs = 60000) => {
    return (req, res, next) => {
        const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
        const now = Date.now();
        
        let record = ipRequests.get(ip);
        if (!record || now - record.startTime > windowMs) {
            record = { count: 1, startTime: now };
            ipRequests.set(ip, record);
        } else {
            record.count++;
            if (record.count > maxReq) {
                return res.status(429).json({ error: "Too many requests. Please try again later." });
            }
        }
        next();
    };
};

// Strict auth rate limiter with failed attempts delay & lockout
exports.authLimiter = (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const email = (req.body.email || "").toLowerCase().trim();
    const key = `${ip}:${email}`;
    const now = Date.now();

    const record = loginAttempts.get(key);
    if (record) {
        // If locked out
        if (record.lockedUntil && now < record.lockedUntil) {
            const remainingMins = Math.ceil((record.lockedUntil - now) / 60000);
            return res.status(429).json({ 
                error: `Account temporarily locked due to repeated failed attempts. Please try again in ${remainingMins} minute(s).` 
            });
        }
    }
    next();
};

exports.recordFailedLogin = (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const email = (req.body.email || "").toLowerCase().trim();
    const key = `${ip}:${email}`;
    const now = Date.now();

    let record = loginAttempts.get(key) || { count: 0, firstAttempt: now, lockedUntil: 0 };
    record.count++;

    // Lock out for 15 minutes after 5 failed attempts
    if (record.count >= 5) {
        record.lockedUntil = now + (15 * 60 * 1000); // 15 mins
    }
    loginAttempts.set(key, record);
};

exports.resetFailedLogin = (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const email = (req.body.email || "").toLowerCase().trim();
    const key = `${ip}:${email}`;
    loginAttempts.delete(key);
};
