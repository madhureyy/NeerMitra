# NeerMitra (नीरमित्र)
> **AI & IoT-Powered Early Warning System for Water-Borne Disease Outbreaks**

NeerMitra is an integrated environmental intelligence platform designed to predict and prevent water-borne disease outbreaks (such as Cholera, Typhoid, Dysentery, and Acute Diarrheal Disease) before they escalate into public health crises in vulnerable regions.

---

## 🌟 Key Features

- **Real-Time IoT Ingestion**: High-throughput REST API endpoint (`POST /api/telemetry`) accepting multi-sensor telemetry (Turbidity, pH, TDS, Temperature, Dissolved Oxygen) from ESP32 microcontrollers and field telemetry stations.
- **AI & WQI Risk Prediction Engine**: Evaluates continuous water quality indices against WHO and Central Pollution Control Board (CPCB) drinking standards, assessing pathogen incubation risks.
- **Geospatial Early Warning Map**: Interactive Leaflet-powered GIS dashboard rendering live water monitoring nodes, contamination statuses, and localized risk alerts across India.
- **Dynamic Geolocation Risk Lookup**: Uses the Haversine geodesic formula to compute proximity-weighted outbreak risks for citizens and health workers based on their live GPS coordinates.
- **Embedded Zero-Config Database**: Persistent SQLite database storing historical time-series sensor telemetry, station registry, and outbreak alerts.
- **Hardware Simulation & Firmware**: Includes ready-to-flash ESP32 Arduino C++ firmware and a multi-station software sensor simulator.

---

## 🏗️ Architecture

```
                                +---------------------------+
                                |  ESP32 / IoT Field Nodes  |
                                | (pH, Turbidity, TDS, Temp)|
                                +-------------+-------------+
                                              |
                                              | HTTP POST /api/telemetry
                                              v
+-----------------------------------------------------------------------------------------+
|                                  NeerMitra Backend                                      |
|                                                                                         |
|  +-----------------------+     +-----------------------+     +-----------------------+  |
|  |     API Endpoints     | --> |   AI Risk Engine      | --> |    SQLite Database    |  |
|  | (Express.js / Node.js)|     |  (WQI & Outbreak ML)  |     | (Tables: nodes, data) |  |
|  +-----------------------+     +-----------------------+     +-----------------------+  |
+-----------------------------------------------------------------------------------------+
                                              |
                                              | JSON Responses
                                              v
                                +---------------------------+
                                |     Frontend Dashboard    |
                                |  - Leaflet GIS Map        |
                                |  - Chart.js Live Graphs   |
                                |  - Dynamic Risk Badges    |
                                +---------------------------+
```

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended; v24 supported natively)
- npm

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/madhureyy/NeerMitra.git
cd NeerMitra
npm install
```

### 2. Start the Backend Server
```bash
npm start
```
The application will launch at **`http://localhost:3000`**.

### 3. (Optional) Run the IoT Sensor Simulator
To test live sensor streaming without physical hardware:
```bash
npm run simulate:iot
```
This script transmits live simulated packets every 4 seconds for stations across India (Guwahati, Patna, Kolkata, Chennai, Mumbai, Delhi).

---

## 📡 API Reference

### 1. Ingest IoT Telemetry
`POST /api/telemetry`
```json
{
  "node_id": "NODE-001",
  "turbidity": 32.5,
  "ph": 7.4,
  "tds": 380,
  "temperature": 27.5,
  "dissolved_oxygen": 5.8
}
```

### 2. Get Monitoring Nodes
`GET /api/nodes`
Returns an array of all active monitoring stations with their latest sensor readings, calculated risk scores, and map color codes.

### 3. Get Time-Series Telemetry
`GET /api/telemetry?node_id=NODE-001`
Returns historical turbidity and pH arrays formatted for Chart.js visualization.

### 4. Calculate Outbreak Risk by Location
`GET /api/risk-score?lat=26.1445&lng=91.7362`
Computes proximity to the nearest water node and returns risk classification (`SAFE`, `WARNING`, `CRITICAL`), primary microbial threats, and health advisories.

### 5. Get Active Outbreak Alerts
`GET /api/alerts`
Returns recent critical risk assessments and recommended public health interventions.

---

## 🔌 Hardware Setup (ESP32)

The firmware is located in [`hardware/esp32_neermitra.ino`](hardware/esp32_neermitra.ino).

### Pin Configuration
| Sensor | ESP32 Pin | Voltage |
| :--- | :--- | :--- |
| **Turbidity Sensor (e.g., SEN0189)** | GPIO 34 (ADC1) | 3.3V / 5V |
| **Analog pH Probe (e.g., pH-4502C)** | GPIO 35 (ADC1) | 3.3V / 5V |
| **Analog TDS Meter** | GPIO 32 (ADC1) | 3.3V |

Flash using the Arduino IDE with `ESP32 Dev Module` selected and update the WiFi credentials and server IP.

---

## 📄 License
MIT License. Developed for water safety and community health monitoring.

