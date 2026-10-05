const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "fairshare.db");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database Connection Error.");
    } else {
        // Enable foreign key constraints and WAL mode for reliability
        db.run("PRAGMA foreign_keys = ON");
        db.run("PRAGMA journal_mode = WAL");
    }
});

// Initialize Tables
db.serialize(() => {
    // USERS TABLE
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            reset_token TEXT,
            reset_expires INTEGER,
            failed_attempts INTEGER DEFAULT 0,
            locked_until INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // GROUPS TABLE
    db.run(`
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            owner_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // MEMBERS TABLE
    db.run(`
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            user_id INTEGER,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            UNIQUE(group_id, email)
        )
    `);

    // EXPENSES TABLE
    db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            amount_paise INTEGER NOT NULL,
            paid_by TEXT NOT NULL,
            paid_by_email TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )
    `);

    // Indexes for fast lookup & authorization checks
    db.run(`CREATE INDEX IF NOT EXISTS idx_members_group_email ON members(group_id, email)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id)`);
});

module.exports = db;
