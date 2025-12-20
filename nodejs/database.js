const Database = require('better-sqlite3');
const path = require('path');

// Initialize SQLite database connection with path configuration
const dbPath = process.env.DB_PATH || path.join(__dirname, 'alm.db');
const db = new Database(dbPath);

// Configure database settings for foreign key support and write-ahead logging
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Creates all required database tables if they don't already exist with appropriate indexes
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        name_color TEXT DEFAULT '#02063fff',
        bio TEXT DEFAULT '',
        account_locked_until DATETIME,
        failed_login_attempts INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        votes INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comment_user_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        comment_id INTEGER NOT NULL,
        vote INTEGER NOT NULL, -- +1 or -1
        UNIQUE(user_id, comment_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

// Creates automatic timestamp update triggers for users and comments tables
db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users 
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_comments_timestamp 
    AFTER UPDATE ON comments 
    BEGIN
        UPDATE comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
`);

module.exports = db;