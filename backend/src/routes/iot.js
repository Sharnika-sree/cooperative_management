const express = require('express');
const router = express.Router();
const { sensorStore } = require('./sensors');

// 1. Ingest Sensor Data from IoT devices (legacy endpoint maintained for backwards compatibility)
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

    const N = nitrogen !== undefined && nitrogen !== null ? parseFloat(nitrogen) : null;
    const P = phosphorus !== undefined && phosphorus !== null ? parseFloat(phosphorus) : null;
    const K = potassium !== undefined && potassium !== null ? parseFloat(potassium) : null;
    const Temp = parseFloat(temperature);
    const Hum = parseFloat(humidity);
    const Moist = parseFloat(moisture);

    if (isNaN(Temp) || isNaN(Hum) || isNaN(Moist)) {
      return res.status(400).json({ error: 'Sensor readings (temperature, humidity, moisture) must be valid numbers.' });
    }

    if (Hum < 0 || Hum > 100 || Moist < 0 || Moist > 100) {
      return res.status(400).json({ error: 'Invalid sensor readings range.' });
    }

    const cleanDeviceId = String(deviceId).trim().toUpperCase();
    const reading = {
      id: `reading_${Date.now()}`,
      deviceId: cleanDeviceId,
      nitrogen: N,
      phosphorus: P,
      potassium: K,
      temperature: Temp,
      humidity: Hum,
      moisture: Moist,
      rawNpk: { nRaw: N, pRaw: P, kRaw: K },
      timestamp: new Date().toISOString(),
      receivedAt: new Date().toISOString()
    };

    if (!sensorStore.byDevice.has(cleanDeviceId)) {
      sensorStore.byDevice.set(cleanDeviceId, []);
    }

    const history = sensorStore.byDevice.get(cleanDeviceId);
    history.unshift(reading);
    if (history.length > 50) history.pop();

    sensorStore.latestGlobal = reading;

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
    const history = sensorStore.byDevice.get(deviceId);

    if (!history || history.length === 0) {
      return res.status(404).json({
        error: `No sensor readings found for device "${deviceId}".`,
        availableDevices: Array.from(sensorStore.byDevice.keys())
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
    if (!sensorStore.latestGlobal) {
      return res.status(404).json({
        error: 'No sensor readings available yet. No sensor device is connected.',
        connected: false
      });
    }
    res.json(sensorStore.latestGlobal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest sensor reading.' });
  }
});

// 4. List all active devices
// GET /api/iot/devices
router.get('/devices', (req, res) => {
  try {
    const devices = Array.from(sensorStore.byDevice.keys()).map(id => ({
      deviceId: id,
      lastSeen: sensorStore.byDevice.get(id)[0]?.receivedAt || sensorStore.byDevice.get(id)[0]?.timestamp || null
    }));
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices.' });
  }
});

module.exports = router;
