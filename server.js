const express = require('express');
const cors = require('cors');
const path = require('path');
const { db } = require('./db/database');
const { calculateRiskMetrics, findNearestStation } = require('./services/riskEngine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files (index.html, etc.)
app.use(express.static(path.join(__dirname)));

// Helper to fetch latest telemetry for a specific node or all nodes
function getLatestTelemetryForNode(nodeId) {
    const stmt = db.prepare(`
        SELECT * FROM sensor_telemetry 
        WHERE node_id = ? 
        ORDER BY id DESC 
        LIMIT 1
    `);
    return stmt.get(nodeId);
}

// -------------------------------------------------------------
// 1. GET /api/nodes - Returns all monitoring stations & current risk
// -------------------------------------------------------------
app.get('/api/nodes', (req, res) => {
    try {
        const nodes = db.prepare('SELECT * FROM monitoring_nodes').all();
        
        const nodesWithRisk = nodes.map(node => {
            const telemetry = getLatestTelemetryForNode(node.node_id) || {
                turbidity: 5.0,
                ph: 7.2,
                tds: 200,
                temperature: 25.0,
                dissolved_oxygen: 6.5
            };

            const risk = calculateRiskMetrics(telemetry);
            const color = risk.status === 'CRITICAL' ? '#FF3366' : (risk.status === 'WARNING' ? '#FBBF24' : '#00F0FF');

            return {
                ...node,
                telemetry: {
                    turbidity: Number(telemetry.turbidity.toFixed(1)),
                    ph: Number(telemetry.ph.toFixed(1)),
                    tds: Math.round(telemetry.tds),
                    temperature: Number(telemetry.temperature.toFixed(1)),
                    dissolved_oxygen: Number(telemetry.dissolved_oxygen.toFixed(1))
                },
                riskScore: risk.score,
                risk: risk.status,
                diseaseRisk: risk.diseaseRisk,
                advisory: risk.advisory,
                color
            };
        });

        res.json({
            count: nodesWithRisk.length,
            nodes: nodesWithRisk
        });
    } catch (error) {
        console.error('Error fetching nodes:', error);
        res.status(500).json({ error: 'Failed to retrieve monitoring nodes' });
    }
});

// -------------------------------------------------------------
// 2. GET /api/telemetry - Returns historical series for Chart.js
// -------------------------------------------------------------
app.get('/api/telemetry', (req, res) => {
    try {
        const { node_id } = req.query;

        // Fetch recent telemetry for the requested node or the highest risk node
        let targetNodeId = node_id;
        if (!targetNodeId) {
            // Default to Guwahati or first active node
            targetNodeId = 'NODE-001';
        }

        const recentReadings = db.prepare(`
            SELECT * FROM sensor_telemetry 
            WHERE node_id = ? 
            ORDER BY id DESC 
            LIMIT 7
        `).all(targetNodeId).reverse();

        // Also fetch current pH across all active nodes for the node comparative bar chart
        const allNodes = db.prepare('SELECT node_id, name FROM monitoring_nodes').all();
        const phLabels = [];
        const phData = [];

        allNodes.forEach((node, index) => {
            const latest = getLatestTelemetryForNode(node.node_id);
            phLabels.push(`Node ${index + 1} (${node.name.split(' ')[0]})`);
            phData.push(latest ? Number(latest.ph.toFixed(1)) : 7.2);
        });

        const turbidityLabels = recentReadings.map((_, i, arr) => {
            const offset = arr.length - 1 - i;
            return offset === 0 ? 'Now' : `t-${offset}`;
        });

        const turbidityData = recentReadings.map(r => Number(r.turbidity.toFixed(1)));

        res.json({
            turbidity: {
                labels: turbidityLabels.length > 0 ? turbidityLabels : ['t-6', 't-5', 't-4', 't-3', 't-2', 't-1', 'Now'],
                data: turbidityData.length > 0 ? turbidityData : [15, 20, 25, 30, 38, 42, 45]
            },
            ph: {
                labels: phLabels,
                data: phData
            },
            nodeId: targetNodeId
        });
    } catch (error) {
        console.error('Error in /api/telemetry:', error);
        res.status(500).json({ error: 'Failed to retrieve telemetry data' });
    }
});

// -------------------------------------------------------------
// 3. GET /api/risk-score - Localized or Aggregate Outbreak Risk
// -------------------------------------------------------------
app.get('/api/risk-score', (req, res) => {
    try {
        const { lat, lng } = req.query;

        if (lat && lng) {
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);

            const allNodes = db.prepare('SELECT * FROM monitoring_nodes').all();
            const nearest = findNearestStation(userLat, userLng, allNodes);

            if (nearest) {
                const latest = getLatestTelemetryForNode(nearest.node_id) || {
                    turbidity: 20,
                    ph: 7.2,
                    tds: 300,
                    temperature: 26,
                    dissolved_oxygen: 5.5
                };

                const risk = calculateRiskMetrics(latest);

                return res.json({
                    score: risk.score,
                    status: risk.status,
                    region: `${nearest.name} (${nearest.distanceKm} km away)`,
                    nearestStation: nearest.name,
                    waterBody: nearest.water_body,
                    distanceKm: nearest.distanceKm,
                    diseaseRisk: risk.diseaseRisk,
                    advisory: risk.advisory,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Aggregate across all nodes if no coordinates given
        const allNodes = db.prepare('SELECT * FROM monitoring_nodes').all();
        let totalScore = 0;
        let count = 0;

        for (const node of allNodes) {
            const latest = getLatestTelemetryForNode(node.node_id);
            if (latest) {
                const metrics = calculateRiskMetrics(latest);
                totalScore += metrics.score;
                count++;
            }
        }

        const avgScore = count > 0 ? Math.round(totalScore / count) : 68;
        const status = avgScore > 75 ? 'CRITICAL' : (avgScore > 40 ? 'WARNING' : 'SAFE');

        res.json({
            score: avgScore,
            status: status,
            region: 'National Aggregate (India Monitoring Grid)',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in /api/risk-score:', error);
        res.status(500).json({ error: 'Failed to calculate risk score' });
    }
});

// -------------------------------------------------------------
// 4. POST /api/telemetry - Real IoT Sensor Ingestion Endpoint
// -------------------------------------------------------------
app.post('/api/telemetry', (req, res) => {
    try {
        const {
            node_id,
            turbidity,
            ph,
            tds = 250,
            temperature = 25.0,
            dissolved_oxygen = 6.5
        } = req.body;

        if (!node_id || turbidity === undefined || ph === undefined) {
            return res.status(400).json({
                error: 'Missing required sensor fields. Expected: node_id, turbidity, ph'
            });
        }

        // Check if node exists; if not, create it dynamically
        const existingNode = db.prepare('SELECT node_id FROM monitoring_nodes WHERE node_id = ?').get(node_id);
        if (!existingNode) {
            db.prepare(`
                INSERT INTO monitoring_nodes (node_id, name, lat, lng, state, water_body, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(node_id, `Auto-registered ${node_id}`, 20.5937, 78.9629, 'Field Deployment', 'Local Reservoir', 'ACTIVE');
        }

        // Insert telemetry reading
        const insertStmt = db.prepare(`
            INSERT INTO sensor_telemetry (node_id, timestamp, turbidity, ph, tds, temperature, dissolved_oxygen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const now = new Date().toISOString();
        insertStmt.run(node_id, now, parseFloat(turbidity), parseFloat(ph), parseFloat(tds), parseFloat(temperature), parseFloat(dissolved_oxygen));

        // Evaluate risk
        const riskMetrics = calculateRiskMetrics({
            turbidity: parseFloat(turbidity),
            ph: parseFloat(ph),
            tds: parseFloat(tds),
            temperature: parseFloat(temperature),
            dissolved_oxygen: parseFloat(dissolved_oxygen)
        });

        // Store risk assessment if Warning or Critical
        if (riskMetrics.status !== 'SAFE') {
            db.prepare(`
                INSERT INTO risk_assessments (node_id, risk_score, risk_level, disease_risk, advisory, calculated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(node_id, riskMetrics.score, riskMetrics.status, riskMetrics.diseaseRisk, riskMetrics.advisory, now);
        }

        res.status(201).json({
            success: true,
            message: 'Sensor telemetry ingested successfully',
            nodeId: node_id,
            assessment: riskMetrics
        });
    } catch (error) {
        console.error('Error ingesting telemetry:', error);
        res.status(500).json({ error: 'Failed to record sensor telemetry' });
    }
});

// -------------------------------------------------------------
// 5. GET /api/alerts - Outbreak alerts & advisories
// -------------------------------------------------------------
app.get('/api/alerts', (req, res) => {
    try {
        const alerts = db.prepare(`
            SELECT r.*, m.name as station_name, m.water_body, m.state
            FROM risk_assessments r
            JOIN monitoring_nodes m ON r.node_id = m.node_id
            ORDER BY r.id DESC
            LIMIT 10
        `).all();

        res.json({
            count: alerts.length,
            alerts
        });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to retrieve alerts' });
    }
});

// -------------------------------------------------------------
// Background Live Simulation (Keeps active telemetry updated)
// -------------------------------------------------------------
setInterval(() => {
    try {
        const nodes = db.prepare('SELECT node_id FROM monitoring_nodes').all();
        const insertStmt = db.prepare(`
            INSERT INTO sensor_telemetry (node_id, timestamp, turbidity, ph, tds, temperature, dissolved_oxygen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const node of nodes) {
            const latest = getLatestTelemetryForNode(node.node_id);
            if (latest) {
                const deltaTurb = (Math.random() - 0.48) * 1.5;
                const newTurbidity = Math.max(1.0, Math.min(100.0, latest.turbidity + deltaTurb));

                const deltaPh = (Math.random() - 0.5) * 0.08;
                const newPh = Math.max(4.0, Math.min(10.5, latest.ph + deltaPh));

                insertStmt.run(
                    node.node_id,
                    new Date().toISOString(),
                    newTurbidity,
                    newPh,
                    latest.tds,
                    latest.temperature,
                    latest.dissolved_oxygen
                );
            }
        }
    } catch (err) {
        // Silently skip if DB is busy during interval
    }
}, 5000);

// Start Server
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`NeerMitra Early Warning Backend running at http://localhost:${PORT}`);
    console.log(`- Web Dashboard:     http://localhost:${PORT}`);
    console.log(`- Telemetry API:     http://localhost:${PORT}/api/telemetry`);
    console.log(`- Nodes GeoJSON API: http://localhost:${PORT}/api/nodes`);
    console.log(`- Risk Score API:    http://localhost:${PORT}/api/risk-score`);
    console.log(`- IoT Ingestion:     POST http://localhost:${PORT}/api/telemetry`);
    console.log(`=======================================================`);
});
