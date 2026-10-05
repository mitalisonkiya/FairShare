// Security headers & CORS middleware
exports.securityHeaders = (req, res, next) => {
    // Content-Security-Policy
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:*;"
    );

    // Prevent MIME-sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Clickjacking defense
    res.setHeader("X-Frame-Options", "DENY");

    // Strict Transport Security (HSTS)
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

    // Referrer Policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions Policy
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // Disable X-Powered-By
    res.removeHeader("X-Powered-By");

    next();
};

// Strict CORS Handler
exports.corsHandler = (req, res, next) => {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
    const origin = req.headers.origin;

    if (origin && (origin === allowedOrigin || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
};
