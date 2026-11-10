/**
 * NeerMitra IoT Sensor Simulator
 * Simulates physical microcontrollers streaming live water quality readings
 * (Turbidity, pH, TDS, Temperature, Dissolved Oxygen) to NeerMitra Backend
 */

const http = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;

const stations = [
    { id: 'NODE-001', name: 'Guwahati (Brahmaputra)', baseTurb: 38.0, basePh: 7.6 },
    { id: 'NODE-002', name: 'Patna (Ganga)', baseTurb: 22.0, basePh: 7.3 },
    { id: 'NODE-003', name: 'Kolkata (Hooghly)', baseTurb: 45.0, basePh: 8.8 },
    { id: 'NODE-004', name: 'Chennai (Cooum)', baseTurb: 18.0, basePh: 6.8 },
    { id: 'NODE-005', name: 'Mumbai (Mithi)', baseTurb: 6.0, basePh: 7.2 },
    { id: 'NODE-006', name: 'Delhi (Yamuna)', baseTurb: 34.0, basePh: 8.6 }
];

function sendReading(station) {
    const payload = JSON.stringify({
        node_id: station.id,
        turbidity: Number((station.baseTurb + (Math.random() * 6 - 3)).toFixed(2)),
        ph: Number((station.basePh + (Math.random() * 0.4 - 0.2)).toFixed(2)),
        tds: Math.round(300 + Math.random() * 200),
        temperature: Number((26.5 + Math.random() * 3).toFixed(1)),
        dissolved_oxygen: Number((5.5 + Math.random() * 1.5).toFixed(1))
    });

    const options = {
        hostname: SERVER_HOST,
        port: SERVER_PORT,
        path: '/api/telemetry',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', chunk => { responseData += chunk; });
        res.on('end', () => {
            try {
                const parsed = JSON.parse(responseData);
                console.log(`[IoT Stream] ${station.name} -> Risk Score: ${parsed.assessment?.score} | Status: ${parsed.assessment?.status}`);
            } catch (e) {
                console.log(`[IoT Stream] Response from ${station.id}: HTTP ${res.statusCode}`);
            }
        });
    });

    req.on('error', (err) => {
        console.error(`[IoT Stream] Connection failed: ${err.message}. Make sure server.js is running.`);
    });

    req.write(payload);
    req.end();
}

console.log('Starting NeerMitra IoT Sensor Simulator...');
console.log('Sending live telemetry packets every 4 seconds. Press Ctrl+C to stop.\n');

// Stream data alternately for stations
let index = 0;
setInterval(() => {
    const station = stations[index];
    sendReading(station);
    index = (index + 1) % stations.length;
}, 4000);

