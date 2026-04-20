const Database = require('better-sqlite3');

// Create DB
const db = new Database('pos.db');

// Enable foreign keys
db.exec(`PRAGMA foreign_keys = ON;`);

module.exports = db;
