const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files (like the index.html we created)
app.use(express.static(path.join(__dirname)));

// --- MOCK DATA GENERATORS ---

// Generate random walk data for turbidity
let currentTurbidity = [12, 19, 15, 25, 42, 38, 45];
const updateTurbidity = () => {
    currentTurbidity.shift();
    const lastVal = currentTurbidity[currentTurbidity.length - 1];
    const change = (Math.random() - 0.5) * 10;
    currentTurbidity.push(Math.max(0, Math.min(100, lastVal + change)));
};
setInterval(updateTurbidity, 5000); // update every 5 seconds

// Generate random data for pH
const getPhData = () => {
    return [
        7.2 + (Math.random() * 0.4 - 0.2), // Node 1
        6.8 + (Math.random() * 0.4 - 0.2), // Node 2
        7.5 + (Math.random() * 0.4 - 0.2), // Node 3
        5.2 + (Math.random() * 0.8 - 0.4), // Node 4 (acidic)
        7.1 + (Math.random() * 0.4 - 0.2)  // Node 5
    ];
};

// --- API ENDPOINTS ---

// Get Telemetry Data (Turbidity and pH)
app.get('/api/telemetry', (req, res) => {
    res.json({
        turbidity: {
            labels: ['t-6', 't-5', 't-4', 't-3', 't-2', 't-1', 'Now'],
            data: currentTurbidity.map(val => Number(val.toFixed(1)))
        },
        ph: {
            labels: ['Node 1', 'Node 2', 'Node 3', 'Node 4', 'Node 5'],
            data: getPhData().map(val => Number(val.toFixed(1)))
        }
    });
});

// Get Aggregate Risk Score
app.get('/api/risk-score', (req, res) => {
    const { lat, lng } = req.query;
    
    let riskScore = 84;
    let status = 'CRITICAL';
    let region = 'Global';
    
    // If location is provided, simulate a localized risk score
    if (lat && lng) {
        // Mock logic: generate a risk score based loosely on coordinates
        const hash = Math.abs(Math.sin(parseFloat(lat) + parseFloat(lng))) * 100;
        riskScore = Math.floor(hash);
        status = riskScore > 75 ? 'CRITICAL' : (riskScore > 40 ? 'WARNING' : 'SAFE');
        region = 'Localized (Your Area)';
    } else {
        // Slight random variance for the global dashboard
        riskScore = Math.min(100, Math.max(0, riskScore + Math.floor((Math.random() * 6) - 3)));
    }

    res.json({
        score: riskScore,
        status: status,
        region: region,
        timestamp: new Date().toISOString()
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`HydroVigil Backend Server is running on http://localhost:${PORT}`);
});
