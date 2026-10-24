const express = require('express');
const router = express.Router();
const {
  isReadingFresh,
  calibrateNpkReading,
  DEFAULT_FRESHNESS_LIMIT_MS
} = require('../utils/sensorCalibration');

// In-memory ring buffer & latest reading store (bounded, zero fake data)
const sensorStore = {
  byDevice: new Map(), // deviceId -> Array of readings (max 50)
  latestGlobal: null
};

// Configurable API key and freshness limit
function getSensorApiKey() {
  return process.env.SENSOR_API_KEY || 'smartcoop_sensor_secret_key_2026';
}

function getFreshnessLimitMs() {
  return parseInt(process.env.SENSOR_FRESHNESS_LIMIT_MS, 10) || DEFAULT_FRESHNESS_LIMIT_MS;
}

// Middleware: Authenticate ESP32 / sensor device submission
function authenticateSensorDevice(req, res, next) {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-sensor-api-key'];
  const expectedKey = getSensorApiKey();

  let providedKey = null;
  if (customHeader) {
    providedKey = String(customHeader).trim();
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7).trim();
  }

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing sensor device API key. Provide header "x-sensor-api-key" or "Authorization: Bearer <KEY>".'
    });
  }

  next();
}

/**
 * 1. POST /api/sensors/readings
 * Receives telemetry from registered ESP32 devices.
 */
router.post('/readings', authenticateSensorDevice, (req, res) => {
  try {
    const {
      deviceId,
      temperature,
      humidity,
      moisture,
      nRaw = null,
      pRaw = null,
      kRaw = null,
      unitMetadata = {},
      timestamp
    } = req.body;

    // Validate deviceId
    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Field "deviceId" is required and must be a non-empty string.'
      });
    }

    // Validate timestamp
    if (!timestamp || typeof timestamp !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Field "timestamp" is required and must be an ISO-8601 string.'
      });
    }

    const parsedTime = new Date(timestamp).getTime();
    if (isNaN(parsedTime)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid timestamp format. Expected valid ISO-8601 date string.'
      });
    }

    // Reject future timestamps (>60s in future to account for slight NTP drift)
    if (parsedTime > Date.now() + 60000) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Timestamp cannot be in the future.'
      });
    }

    // Parse and validate required numeric environmental values
    const temp = parseFloat(temperature);
    const hum = parseFloat(humidity);
    const moist = parseFloat(moisture);

    if (!Number.isFinite(temp) || !Number.isFinite(hum) || !Number.isFinite(moist)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Fields "temperature", "humidity", and "moisture" must be finite valid numbers.'
      });
    }

    // Numerical range constraints
    // Temperature: typical ambient/soil operational range -10°C to 65°C
    if (temp < -10.0 || temp > 65.0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Temperature reading out of plausible operational range (-10°C to 65°C).'
      });
    }

    // Humidity: 0% to 100%
    if (hum < 0.0 || hum > 100.0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Humidity reading must be between 0% and 100%.'
      });
    }

    // Moisture: 0% to 100%
    if (moist < 0.0 || moist > 100.0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Soil moisture reading must be between 0% and 100%.'
      });
    }

    // Validate raw NPK if provided (must not be negative or NaN)
    const validateRawNutrient = (val, name) => {
      if (val === null || val === undefined) return null;
      const parsed = parseFloat(val);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`Raw nutrient "${name}" must be a non-negative finite number or null.`);
      }
      return parsed;
    };

    let parsedNRaw, parsedPRaw, parsedKRaw;
    try {
      parsedNRaw = validateRawNutrient(nRaw, 'nRaw');
      parsedPRaw = validateRawNutrient(pRaw, 'pRaw');
      parsedKRaw = validateRawNutrient(kRaw, 'kRaw');
    } catch (validationErr) {
      return res.status(400).json({
        error: 'Validation Error',
        message: validationErr.message
      });
    }

    // Process calibration interface (explicitly separate raw from calibrated)
    const calibratedNpk = calibrateNpkReading({
      nRaw: parsedNRaw,
      pRaw: parsedPRaw,
      kRaw: parsedKRaw,
      unitMetadata: typeof unitMetadata === 'object' && unitMetadata !== null ? unitMetadata : {}
    });

    const cleanDeviceId = deviceId.trim().toUpperCase();
    const reading = {
      id: `reading_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      deviceId: cleanDeviceId,
      temperature: temp,
      humidity: hum,
      moisture: moist,
      rawNpk: {
        nRaw: parsedNRaw,
        pRaw: parsedPRaw,
        kRaw: parsedKRaw
      },
      calibratedNpk,
      unitMetadata: typeof unitMetadata === 'object' && unitMetadata !== null ? unitMetadata : {},
      deviceTimestamp: timestamp,
      receivedAt: new Date().toISOString()
    };

    // Store in ring buffer (max 50 per device)
    if (!sensorStore.byDevice.has(cleanDeviceId)) {
      sensorStore.byDevice.set(cleanDeviceId, []);
    }
    const history = sensorStore.byDevice.get(cleanDeviceId);
    history.unshift(reading);
    if (history.length > 50) history.pop();

    sensorStore.latestGlobal = reading;

    return res.status(201).json({
      success: true,
      message: 'Sensor reading accepted and validated successfully.',
      reading
    });
  } catch (error) {
    console.error('Error ingesting sensor reading:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process sensor reading.'
    });
  }
});

/**
 * 2. GET /api/sensors/status
 * Returns genuine sensor connection status and freshness.
 */
router.get('/status', (req, res) => {
  try {
    const requestedDevice = req.query.deviceId ? String(req.query.deviceId).trim().toUpperCase() : null;
    const freshnessLimitMs = getFreshnessLimitMs();

    let targetReading = null;
    if (requestedDevice) {
      const history = sensorStore.byDevice.get(requestedDevice);
      if (history && history.length > 0) targetReading = history[0];
    } else {
      targetReading = sensorStore.latestGlobal;
    }

    if (!targetReading) {
      return res.json({
        connected: false,
        status: 'Not Connected',
        message: 'No sensor device is connected. Connect an ESP32 device to receive live readings.',
        latestReadingTime: null,
        receivedAt: null,
        freshnessLimitSeconds: Math.round(freshnessLimitMs / 1000),
        registeredDevices: Array.from(sensorStore.byDevice.keys())
      });
    }

    const isFresh = isReadingFresh(targetReading.receivedAt || targetReading.deviceTimestamp, freshnessLimitMs);

    if (!isFresh) {
      return res.json({
        connected: false,
        status: 'Stale',
        message: 'Sensor device readings are stale. Device may be offline or stopped transmitting.',
        deviceId: targetReading.deviceId,
        latestReadingTime: targetReading.deviceTimestamp,
        receivedAt: targetReading.receivedAt,
        isFresh: false,
        freshnessLimitSeconds: Math.round(freshnessLimitMs / 1000)
      });
    }

    return res.json({
      connected: true,
      status: 'Connected',
      message: 'Sensor device is online and transmitting live telemetry.',
      deviceId: targetReading.deviceId,
      latestReadingTime: targetReading.deviceTimestamp,
      receivedAt: targetReading.receivedAt,
      isFresh: true,
      freshnessLimitSeconds: Math.round(freshnessLimitMs / 1000)
    });
  } catch (error) {
    console.error('Error fetching sensor status:', error);
    return res.status(500).json({ error: 'Failed to retrieve sensor status.' });
  }
});

/**
 * 3. GET /api/sensors/latest
 * Returns latest valid reading if available and fresh.
 */
router.get('/latest', (req, res) => {
  try {
    const requestedDevice = req.query.deviceId ? String(req.query.deviceId).trim().toUpperCase() : null;
    const freshnessLimitMs = getFreshnessLimitMs();

    let targetReading = null;
    if (requestedDevice) {
      const history = sensorStore.byDevice.get(requestedDevice);
      if (history && history.length > 0) targetReading = history[0];
    } else {
      targetReading = sensorStore.latestGlobal;
    }

    if (!targetReading) {
      return res.status(404).json({
        connected: false,
        reading: null,
        message: 'No sensor device is connected. Connect an ESP32 device to receive live readings.'
      });
    }

    const isFresh = isReadingFresh(targetReading.receivedAt || targetReading.deviceTimestamp, freshnessLimitMs);

    return res.json({
      connected: isFresh,
      isFresh,
      reading: targetReading,
      message: isFresh ? 'Active live reading retrieved.' : 'Latest reading is stale.'
    });
  } catch (error) {
    console.error('Error fetching latest sensor reading:', error);
    return res.status(500).json({ error: 'Failed to retrieve latest sensor reading.' });
  }
});

module.exports = {
  router,
  sensorStore
};

