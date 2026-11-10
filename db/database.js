const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'neermitra.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize Tables
function initDatabase() {
    // 1. Monitoring Nodes (IoT station locations)
    db.exec(`
        CREATE TABLE IF NOT EXISTS monitoring_nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            state TEXT NOT NULL,
            water_body TEXT,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Telemetry measurements (historical time-series from sensors)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sensor_telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            turbidity REAL NOT NULL,
            ph REAL NOT NULL,
            tds REAL DEFAULT 150.0,
            temperature REAL DEFAULT 24.5,
            dissolved_oxygen REAL DEFAULT 6.5,
            FOREIGN KEY(node_id) REFERENCES monitoring_nodes(node_id)
        );
    `);

    // 3. Risk assessments & outbreak alerts
    db.exec(`
        CREATE TABLE IF NOT EXISTS risk_assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT NOT NULL,
            risk_score INTEGER NOT NULL,
            risk_level TEXT NOT NULL,
            disease_risk TEXT,
            advisory TEXT,
            calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(node_id) REFERENCES monitoring_nodes(node_id)
        );
    `);

    // Seed default nodes if empty
    const checkNodes = db.prepare('SELECT COUNT(*) as count FROM monitoring_nodes').get();
    if (checkNodes.count === 0) {
        seedInitialData();
    }
}

function seedInitialData() {
    const insertNode = db.prepare(`
        INSERT INTO monitoring_nodes (node_id, name, lat, lng, state, water_body, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const initialNodes = [
        ['NODE-001', 'Guwahati Station', 26.1445, 91.7362, 'Assam', 'Brahmaputra River', 'ACTIVE'],
        ['NODE-002', 'Patna Station', 25.5941, 85.1376, 'Bihar', 'Ganga River', 'ACTIVE'],
        ['NODE-003', 'Kolkata Station', 22.5726, 88.3639, 'West Bengal', 'Hooghly River', 'ACTIVE'],
        ['NODE-004', 'Chennai Station', 13.0827, 80.2707, 'Tamil Nadu', 'Cooum / Adyar River', 'ACTIVE'],
        ['NODE-005', 'Mumbai Station', 19.0760, 72.8777, 'Maharashtra', 'Mithi River', 'ACTIVE'],
        ['NODE-006', 'Delhi Station', 28.6139, 77.2090, 'Delhi', 'Yamuna River', 'ACTIVE']
    ];

    for (const node of initialNodes) {
        insertNode.run(...node);
    }

    // Seed initial telemetry records for each node
    const insertTelemetry = db.prepare(`
        INSERT INTO sensor_telemetry (node_id, timestamp, turbidity, ph, tds, temperature, dissolved_oxygen)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
        const time = new Date(now - i * 5000).toISOString();
        // Guwahati: Higher turbidity (flood/monsoon zone)
        insertTelemetry.run('NODE-001', time, 42.0 + Math.random() * 8, 7.8, 480, 28.2, 4.8);
        // Patna: Moderate
        insertTelemetry.run('NODE-002', time, 24.5 + Math.random() * 5, 7.4, 320, 26.5, 5.5);
        // Kolkata: High contamination
        insertTelemetry.run('NODE-003', time, 46.0 + Math.random() * 7, 8.9, 620, 29.0, 3.9);
        // Chennai: Moderate
        insertTelemetry.run('NODE-004', time, 18.0 + Math.random() * 4, 6.7, 390, 27.8, 6.0);
        // Mumbai: Safe range
        insertTelemetry.run('NODE-005', time, 4.2 + Math.random() * 2, 7.2, 180, 25.0, 7.2);
        // Delhi: High organic pollution
        insertTelemetry.run('NODE-006', time, 32.0 + Math.random() * 6, 8.7, 540, 27.5, 4.2);
    }
}

initDatabase();

module.exports = {
    db,
    initDatabase
};

