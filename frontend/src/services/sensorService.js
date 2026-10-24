/**
 * Sensor Service
 * 
 * Provides client-side helpers to inspect IoT sensor telemetry and connection status.
 * Note: Sensor ingestion authentication is handled securely between the physical ESP32 device
 * and the backend API; no device secrets are exposed to the browser client.
 */
import axios from 'axios';

/**
 * Fetch current sensor connection status from the backend.
 * 
 * @param {string} [deviceId] - Optional specific device identifier to query
 * @returns {Promise<Object>} { connected, status, message, latestReadingTime, isFresh }
 */
export async function fetchSensorStatus(deviceId = null) {
  try {
    const url = deviceId 
      ? `/api/sensors/status?deviceId=${encodeURIComponent(deviceId)}` 
      : '/api/sensors/status';
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error('Failed to fetch sensor status:', err);
    return {
      connected: false,
      status: 'Unavailable',
      message: 'Sensor status service is temporarily unreachable.',
      error: err.response?.data?.error || err.message
    };
  }
}

/**
 * Fetch the latest validated sensor reading.
 * 
 * @param {string} [deviceId] - Optional specific device identifier to query
 * @returns {Promise<Object>} { connected, isFresh, reading, message }
 */
export async function fetchLatestReading(deviceId = null) {
  try {
    const url = deviceId 
      ? `/api/sensors/latest?deviceId=${encodeURIComponent(deviceId)}` 
      : '/api/sensors/latest';
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return {
        connected: false,
        reading: null,
        message: err.response.data?.message || 'No sensor readings found.'
      };
    }
    console.error('Failed to fetch latest sensor reading:', err);
    throw err;
  }
}

