const express = require('express');
const router = express.Router();

// In-memory ring buffer / cache for IoT sensor data
const sensorDataCache = new Map();
let latestGlobalReading = {
  deviceId: 'SOIL-001',
  nitrogen: 45,
  phosphorus: 30,
  potassium: 40,
  temperature: 29.0,
  humidity: 70.0,
  moisture: 3.5,
  timestamp: new Date()
};

// Seed default reading
sensorDataCache.set('SOIL-001', [latestGlobalReading]);

// 1. Ingest Sensor Data from IoT devices (e.g. ESP32)
// POST /api/iot/sensor-data
router.post('/sensor-data', (req, res) => {
  try {
    const {
      deviceId = 'SOIL-001',
      nitrogen,
      phosphorus,
      potassium,
      temperature,
      humidity,
      moisture
    } = req.body;

    const N = parseFloat(nitrogen);
    const P = parseFloat(phosphorus);
    const K = parseFloat(potassium);
    const Temp = parseFloat(temperature);
    const Hum = parseFloat(humidity);
    const Moist = parseFloat(moisture);

    if (isNaN(N) || isNaN(P) || isNaN(K) || isNaN(Temp) || isNaN(Hum) || isNaN(Moist)) {
      return res.status(400).json({ error: 'All sensor readings (nitrogen, phosphorus, potassium, temperature, humidity, moisture) must be valid numbers.' });
    }

    if (N < 0 || P < 0 || K < 0 || Hum < 0 || Hum > 100 || Moist < 0) {
      return res.status(400).json({ error: 'Invalid sensor readings range.' });
    }

    const reading = {
      id: `reading_${Date.now()}`,
      deviceId: String(deviceId).trim().toUpperCase(),
      nitrogen: N,
      phosphorus: P,
      potassium: K,
      temperature: Temp,
      humidity: Hum,
      moisture: Moist,
      timestamp: new Date()
    };

    if (!sensorDataCache.has(reading.deviceId)) {
      sensorDataCache.set(reading.deviceId, []);
    }

    const history = sensorDataCache.get(reading.deviceId);
    history.unshift(reading);
    if (history.length > 50) history.pop(); // Keep latest 50 readings per device

    latestGlobalReading = reading;

    res.status(201).json({
      success: true,
      message: 'Sensor data recorded successfully.',
      reading
    });
  } catch (error) {
    console.error('Error recording IoT sensor data:', error);
    res.status(500).json({ error: 'Failed to process sensor reading.' });
  }
});

// 2. Get latest sensor reading by deviceId
// GET /api/iot/latest/:deviceId
router.get('/latest/:deviceId', (req, res) => {
  try {
    const deviceId = req.params.deviceId.trim().toUpperCase();
    const history = sensorDataCache.get(deviceId);

    if (!history || history.length === 0) {
      return res.status(404).json({
        error: `No sensor readings found for device "${deviceId}".`,
        availableDevices: Array.from(sensorDataCache.keys())
      });
    }

    res.json(history[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensor reading.' });
  }
});

// 3. Get latest sensor reading globally
// GET /api/iot/latest
router.get('/latest', (req, res) => {
  try {
    res.json(latestGlobalReading);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest sensor reading.' });
  }
});

// 4. List all active devices
// GET /api/iot/devices
router.get('/devices', (req, res) => {
  try {
    const devices = Array.from(sensorDataCache.keys()).map(id => ({
      deviceId: id,
      lastSeen: sensorDataCache.get(id)[0]?.timestamp || null
    }));
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices.' });
  }
});

module.exports = router;
