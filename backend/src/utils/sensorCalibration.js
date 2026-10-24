/**
 * Sensor Calibration & Model Compatibility Utility
 * 
 * Defines the contract and transformation logic between raw IoT sensor telemetry
 * (such as ESP32 + Modbus / RS485 soil sensors) and the CatBoost ML model input constraints.
 * 
 * CRITICAL AGRONOMIC RULE:
 * Raw sensor outputs (e.g. electrical conductivity, raw ADC, uncalibrated optical/chemical estimates)
 * MUST NOT be assumed to equal soil nutrient concentrations (mg/kg) or the CatBoost model's
 * standardized N_score, P_score, and K_score (typically 0.0=Low, 0.5=Medium, 1.0=High).
 */

const DEFAULT_FRESHNESS_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Determine if a reading is fresh based on its timestamp and the configured freshness window.
 * 
 * @param {string|Date} timestamp - The ISO-8601 timestamp from the sensor reading.
 * @param {number} [limitMs] - Max allowable age in milliseconds (defaults to env or 15 mins).
 * @returns {boolean} True if the reading is within the freshness window.
 */
function isReadingFresh(timestamp, limitMs) {
  if (!timestamp) return false;
  const readingTime = new Date(timestamp).getTime();
  if (isNaN(readingTime)) return false;
  
  const configuredLimit = limitMs || parseInt(process.env.SENSOR_FRESHNESS_LIMIT_MS, 10) || DEFAULT_FRESHNESS_LIMIT_MS;
  const now = Date.now();
  
  // Future timestamps beyond 1 minute skew tolerance are rejected
  if (readingTime > now + 60000) return false;
  
  return (now - readingTime) <= configuredLimit;
}

/**
 * Calibration interface for NPK sensor readings.
 * 
 * When physical sensors (e.g. Modbus RS485 NPK soil sensor) are integrated in the future,
 * their raw readings (raw ADC, voltage, or uncalibrated ppm estimates) must be calibrated
 * against laboratory soil sample standards before being transformed into model-compatible scores.
 * 
 * @param {Object} rawData - Object containing raw readings: { nRaw, pRaw, kRaw, unitMetadata }
 * @param {Object} [sensorProfile] - Calibration curve metadata, soil type profile, probe model
 * @returns {Object} Structured calibration result
 */
function calibrateNpkReading(rawData = {}, sensorProfile = null) {
  const { nRaw = null, pRaw = null, kRaw = null, unitMetadata = {} } = rawData;

  // If a verified calibration profile is provided and active:
  if (sensorProfile && sensorProfile.isVerified && typeof sensorProfile.convertFn === 'function') {
    try {
      const calibrated = sensorProfile.convertFn({ nRaw, pRaw, kRaw, unitMetadata });
      return {
        isCalibrated: true,
        calibrationStatus: 'CALIBRATED',
        nScore: calibrated.nScore,
        pScore: calibrated.pScore,
        kScore: calibrated.kScore,
        rawValues: { nRaw, pRaw, kRaw },
        method: sensorProfile.name || 'Verified Lab Calibration'
      };
    } catch (err) {
      console.error('NPK Calibration conversion error:', err);
    }
  }

  // DEFAULT / UNVERIFIED STATE:
  // Explicitly do NOT fabricate scores or assume raw sensor values equal model scores.
  return {
    isCalibrated: false,
    calibrationStatus: 'UNCALIBRATED',
    nScore: null,
    pScore: null,
    kScore: null,
    rawValues: {
      nRaw: nRaw !== null && !isNaN(nRaw) ? parseFloat(nRaw) : null,
      pRaw: pRaw !== null && !isNaN(pRaw) ? parseFloat(pRaw) : null,
      kRaw: kRaw !== null && !isNaN(kRaw) ? parseFloat(kRaw) : null
    },
    reason: 'Raw sensor readings require physical probe calibration and soil lab correlation before mapping to CatBoost model N_score, P_score, and K_score.',
    guidance: 'Enter calibrated NPK scores manually (0 to 100 or 0.0, 0.5, 1.0) or use Manual Entry until sensor calibration curve is established.'
  };
}

/**
 * Validates and prepares inputs for CatBoost ML inference from sensor telemetry.
 * 
 * The CatBoost model expects:
 * - district_name (categorical)
 * - CROPS (categorical)
 * - Temperature (Float, °C)
 * - Humidity (Float, %)
 * - Moisture (Float, %)
 * - N_score (Float: 0.0, 0.5, 1.0)
 * - P_score (Float: 0.0, 0.5, 1.0)
 * - K_score (Float: 0.0, 0.5, 1.0)
 * 
 * @param {Object} params - { reading, district, crop, manualNpkOverrides }
 * @returns {Object} { readyForModel: boolean, modelInputs: Object|null, missingOrUncalibrated: string[] }
 */
function prepareModelInputs({ reading, district, crop, manualNpkOverrides = null }) {
  const missingOrUncalibrated = [];

  if (!district || !String(district).trim()) {
    missingOrUncalibrated.push('district');
  }
  if (!crop || !String(crop).trim()) {
    missingOrUncalibrated.push('crop');
  }

  if (!reading) {
    return {
      readyForModel: false,
      modelInputs: null,
      missingOrUncalibrated: ['sensorReading', ...missingOrUncalibrated]
    };
  }

  const temp = parseFloat(reading.temperature);
  const hum = parseFloat(reading.humidity);
  const moist = parseFloat(reading.moisture);

  if (isNaN(temp)) missingOrUncalibrated.push('temperature');
  if (isNaN(hum)) missingOrUncalibrated.push('humidity');
  if (isNaN(moist)) missingOrUncalibrated.push('moisture');

  // NPK Handling: check if calibrated or manually supplied
  let nScore = null;
  let pScore = null;
  let kScore = null;

  if (manualNpkOverrides) {
    if (manualNpkOverrides.nScore !== undefined && manualNpkOverrides.nScore !== null) {
      nScore = parseFloat(manualNpkOverrides.nScore);
    }
    if (manualNpkOverrides.pScore !== undefined && manualNpkOverrides.pScore !== null) {
      pScore = parseFloat(manualNpkOverrides.pScore);
    }
    if (manualNpkOverrides.kScore !== undefined && manualNpkOverrides.kScore !== null) {
      kScore = parseFloat(manualNpkOverrides.kScore);
    }
  } else if (reading.calibratedNpk && reading.calibratedNpk.isCalibrated) {
    nScore = reading.calibratedNpk.nScore;
    pScore = reading.calibratedNpk.pScore;
    kScore = reading.calibratedNpk.kScore;
  }

  if (nScore === null || isNaN(nScore)) missingOrUncalibrated.push('N_score (uncalibrated or missing)');
  if (pScore === null || isNaN(pScore)) missingOrUncalibrated.push('P_score (uncalibrated or missing)');
  if (kScore === null || isNaN(kScore)) missingOrUncalibrated.push('K_score (uncalibrated or missing)');

  if (missingOrUncalibrated.length > 0) {
    return {
      readyForModel: false,
      modelInputs: null,
      missingOrUncalibrated
    };
  }

  return {
    readyForModel: true,
    modelInputs: {
      district_name: String(district).trim(),
      CROPS: String(crop).trim().toLowerCase(),
      Temperature: temp,
      Humidity: hum,
      Moisture: moist,
      N_score: nScore,
      P_score: pScore,
      K_score: kScore
    },
    missingOrUncalibrated: []
  };
}

module.exports = {
  DEFAULT_FRESHNESS_LIMIT_MS,
  isReadingFresh,
  calibrateNpkReading,
  prepareModelInputs
};

