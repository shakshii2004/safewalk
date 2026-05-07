/**
 * Real-time Safety Risk Engine
 * Calculates dynamic risk score (0-100) using only real environmental factors.
 * No simulated crowd density or random values are used.
 * 
 * @param {Object} location - User GPS location { lat, lng }
 * @param {Date} time - Current time object
 * @param {number} reportCount - Number of real user reports nearby (Firebase)
 * @param {Object} placesContext - Google Places API data { nearPolice, noNearbyPlaces, nearRiskyZone }
 * @param {number} previousRisk - The last calculated risk score (for UI stability)
 * @returns {Object} { score, level, factors }
 */
export const calculateRiskScore = (location, time, reportCount = 0, placesContext = {}, previousRisk = -1) => {
    // 1. Base Risk
    let risk = 10;
    const factors = [];

    factors.push("Base risk established");

    // 2. Reports-Based Risk (PRIMARY DRIVER)
    if (reportCount > 0) {
        const reportImpact = reportCount * 15;
        risk += reportImpact;
        factors.push(`${reportCount} nearby reports (+${reportImpact})`);
    }

    // 3. Location Context (REAL PLACES DATA)
    const { nearPolice = false, noNearbyPlaces = false, nearRiskyZone = false } = placesContext;

    if (nearPolice) {
        risk -= 10;
        factors.push("Near police station (-10)");
    }

    if (noNearbyPlaces) {
        risk += 10;
        factors.push("Isolated area (+10)");
    }

    // 4. Time Factor (MINOR ONLY)
    const hour = time.getHours();
    const isNight = hour >= 20 || hour <= 5;

    if (isNight) {
        risk += 15;
        factors.push("Night time predictive factor (+15)");
    }

    // 5. Safe Condition Adjustment
    if (reportCount === 0 && !nearRiskyZone && !noNearbyPlaces) {
        risk = Math.max(risk - 5, 0);
        factors.push("Safe conditions present (-5)");
    }

    // 6. Clamp Output
    risk = Math.min(Math.max(risk, 0), 100);

    // 7. Stability Requirement
    // Prevent unnecessary fluctuations. Only update if change ≥ 5 or first run
    if (previousRisk !== -1 && Math.abs(risk - previousRisk) < 5) {
        risk = previousRisk;
    }

    // 8. Risk Levels
    let level = "LOW";
    if (risk > 60) {
        level = "HIGH";
    } else if (risk > 30) {
        level = "MEDIUM";
    }

    return {
        score: risk,
        level,
        reasons: factors // Kept as 'reasons' for UI compatibility, functionally 'factors'
    };
};
