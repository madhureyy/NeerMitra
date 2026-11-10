/**
 * NeerMitra Water Safety & Outbreak Risk Assessment Engine
 * Based on WHO & CPCB (Central Pollution Control Board) Water Quality Standards
 */

// Calculate Water-Borne Outbreak Risk Score (0 - 100)
function calculateRiskMetrics(telemetry) {
    const { turbidity = 5, ph = 7.0, tds = 250, temperature = 25, dissolved_oxygen = 6.5 } = telemetry;

    let score = 0;
    const flags = [];

    // 1. Turbidity Impact (Max 45 points)
    // Turbidity shields microbial pathogens from UV and chlorine disinfection
    if (turbidity > 35) {
        score += 45;
        flags.push('Extremely high turbidity: high pathogen suspension');
    } else if (turbidity > 20) {
        score += 35;
        flags.push('Severe turbidity: disinfection compromised');
    } else if (turbidity > 10) {
        score += 25;
        flags.push('Elevated turbidity: potential microbial load');
    } else if (turbidity > 5) {
        score += 15;
        flags.push('Moderate turbidity: filtration recommended');
    } else if (turbidity > 1) {
        score += 5;
    }

    // 2. pH Deviation Impact (Max 25 points)
    // Safe standard: 6.5 - 8.5. Optimal: 7.0 - 7.5
    if (ph < 5.5 || ph > 9.5) {
        score += 25;
        flags.push(`Extreme pH level (${ph.toFixed(1)}): severe toxic/chemical hazard`);
    } else if (ph < 6.5 || ph > 8.5) {
        score += 18;
        flags.push(`Abnormal pH (${ph.toFixed(1)}): out of permissible drinking limits`);
    } else if (ph < 6.8 || ph > 8.0) {
        score += 8;
    }

    // 3. TDS (Total Dissolved Solids) Impact (Max 15 points)
    if (tds > 1000) {
        score += 15;
        flags.push(`Critical TDS (${tds} ppm): severe mineralization/effluent`);
    } else if (tds > 600) {
        score += 10;
        flags.push(`High TDS (${tds} ppm): poor mineral balance`);
    } else if (tds > 300) {
        score += 5;
    }

    // 4. Dissolved Oxygen & Temperature (Incubation Factor, Max 15 points)
    if (dissolved_oxygen < 4.0) {
        score += 10;
        flags.push('Depleted dissolved oxygen: organic decay detected');
    }
    // High temperature (> 27°C) accelerates Vibrio cholerae & Salmonella incubation
    if (temperature > 27.5 && turbidity > 15) {
        score += 5;
        flags.push('Warm water temperature accelerating microbial proliferation');
    }

    // Clamp score between 0 and 100
    score = Math.min(100, Math.max(0, Math.round(score)));

    // Categorization
    let status = 'SAFE';
    let diseaseRisk = 'Minimal Outbreak Risk';
    let advisory = 'Water parameters within acceptable public health safety norms.';

    if (score > 75) {
        status = 'CRITICAL';
        if (temperature > 26 && turbidity > 25) {
            diseaseRisk = 'High Outbreak Probability: Cholera / Acute Diarrheal Disease (ADD)';
        } else {
            diseaseRisk = 'Critical Microbial Contamination: Dysentery & Enteric Pathogens';
        }
        advisory = 'DO NOT DRINK UNTREATED. Immediate municipal chlorination and boiling required.';
    } else if (score > 40) {
        status = 'WARNING';
        diseaseRisk = 'Moderate Threat: Bacterial Infection / Typhoid Risk';
        advisory = 'Precautionary advisory: boil or filter water before direct consumption.';
    }

    return {
        score,
        status,
        diseaseRisk,
        advisory,
        flags
    };
}

// Haversine formula to compute distance between two GPS coordinates in kilometers
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
}

// Find nearest monitoring station to given coordinates
function findNearestStation(userLat, userLng, nodes) {
    if (!nodes || nodes.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    for (const node of nodes) {
        const dist = calculateDistanceKm(userLat, userLng, node.lat, node.lng);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = {
                ...node,
                distanceKm: dist
            };
        }
    }

    return nearest;
}

module.exports = {
    calculateRiskMetrics,
    calculateDistanceKm,
    findNearestStation
};

