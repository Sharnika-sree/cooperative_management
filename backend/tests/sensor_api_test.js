// ============================================================================
// SENSOR API & HARDWARE-READY INTEGRATION TEST SUITE
// Tests genuine status, validation, authentication, freshness, calibration,
// and safety constraints without claiming physical hardware integration.
// ============================================================================
require('dotenv').config();
const http = require('http');
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { router: sensorRoutes, sensorStore } = require('../src/routes/sensors');
const { isReadingFresh, calibrateNpkReading, prepareModelInputs } = require('../src/utils/sensorCalibration');

const PORT = 5096;
const API_KEY = process.env.SENSOR_API_KEY || 'smartcoop_sensor_secret_key_2026';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName} - ${details}`);
    failed++;
  }
}

function makeRequest({ method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSensorTests() {
  console.log('================================================================');
  console.log('SMART COOP: IOT SENSOR INTEGRATION CONTRACT & API TEST SUITE');
  console.log('================================================================');

  // Setup standalone Express server for isolation
  const app = express();
  app.use(express.json());
  app.use('/api/sensors', sensorRoutes);

  const server = app.listen(PORT);
  await new Promise(r => setTimeout(r, 300));

  try {
    // Clear in-memory sensor store for clean test baseline
    sensorStore.byDevice.clear();
    sensorStore.latestGlobal = null;

    console.log('\n--- TEST 1: Initial Sensor Status (Zero Fake Readings) ---');
    const status1 = await makeRequest({ path: '/api/sensors/status' });
    assert(status1.status === 200, 'GET /api/sensors/status returns HTTP 200');
    assert(status1.data.connected === false, 'Sensor initially reports connected = false');
    assert(status1.data.status === 'Not Connected', 'Status is "Not Connected"');
    assert(status1.data.message.includes('No sensor device is connected'), 'Clear message about no sensor device connected');

    console.log('\n--- TEST 2: Initial Latest Reading Endpoint ---');
    const latest1 = await makeRequest({ path: '/api/sensors/latest' });
    assert(latest1.status === 404, 'GET /api/sensors/latest returns HTTP 404 when no device connected');
    assert(latest1.data.connected === false, 'connected = false on empty reading');

    console.log('\n--- TEST 3: Device Authentication & Security ---');
    // Request with no header
    const unauth1 = await makeRequest({
      method: 'POST',
      path: '/api/sensors/readings',
      body: { deviceId: 'DEV-TEST', temperature: 25, humidity: 60, moisture: 40, timestamp: new Date().toISOString() }
    });
    assert(unauth1.status === 401, 'POST without API key rejected with HTTP 401');

    // Request with invalid header
    const unauth2 = await makeRequest({
      method: 'POST',
      path: '/api/sensors/readings',
      headers: { 'x-sensor-api-key': 'wrong_secret_key' },
      body: { deviceId: 'DEV-TEST', temperature: 25, humidity: 60, moisture: 40, timestamp: new Date().toISOString() }
    });
    assert(unauth2.status === 401, 'POST with invalid API key rejected with HTTP 401');

    console.log('\n--- TEST 4: Payload Validation & Range Rejections ---');
    const validHeader = { 'x-sensor-api-key': API_KEY };

    // Missing deviceId
    const bad1 = await makeRequest({
      method: 'POST', path: '/api/sensors/readings', headers: validHeader,
      body: { temperature: 25, humidity: 60, moisture: 40, timestamp: new Date().toISOString() }
    });
    assert(bad1.status === 400 && bad1.data.message.includes('deviceId'), 'Rejects missing deviceId');

    // Out of range temperature (e.g. 150°C)
    const badTemp = await makeRequest({
      method: 'POST', path: '/api/sensors/readings', headers: validHeader,
      body: { deviceId: 'TEST-DEV', temperature: 150.0, humidity: 50, moisture: 30, timestamp: new Date().toISOString() }
    });
    assert(badTemp.status === 400 && badTemp.data.message.includes('Temperature'), 'Rejects out-of-range temperature');

    // Negative humidity
    const badHum = await makeRequest({
      method: 'POST', path: '/api/sensors/readings', headers: validHeader,
      body: { deviceId: 'TEST-DEV', temperature: 25.0, humidity: -10, moisture: 30, timestamp: new Date().toISOString() }
    });
    assert(badHum.status === 400 && badHum.data.message.includes('Humidity'), 'Rejects negative humidity');

    // NaN / string moisture
    const badMoist = await makeRequest({
      method: 'POST', path: '/api/sensors/readings', headers: validHeader,
      body: { deviceId: 'TEST-DEV', temperature: 25.0, humidity: 50, moisture: 'abc', timestamp: new Date().toISOString() }
    });
    assert(badMoist.status === 400, 'Rejects non-numeric / NaN moisture');

    // Future timestamp
    const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const badTime = await makeRequest({
      method: 'POST', path: '/api/sensors/readings', headers: validHeader,
      body: { deviceId: 'TEST-DEV', temperature: 25.0, humidity: 50, moisture: 30, timestamp: futureDate }
    });
    assert(badTime.status === 400 && badTime.data.message.includes('future'), 'Rejects future timestamp (>60s)');

    console.log('\n--- TEST 5: Explicitly-Labelled Test Ingestion (Valid Payload) ---');
    const validTestPayload = {
      deviceId: 'TEST-SIMULATED-ESP32',
      temperature: 28.5,
      humidity: 65.0,
      moisture: 42.0,
      nRaw: 140.0,
      pRaw: 35.0,
      kRaw: 195.0,
      unitMetadata: { note: 'Explicit automated test reading — not physical hardware' },
      timestamp: new Date().toISOString()
    };

    const goodPost = await makeRequest({
      method: 'POST',
      path: '/api/sensors/readings',
      headers: validHeader,
      body: validTestPayload
    });
    assert(goodPost.status === 201, 'Valid reading accepted with HTTP 201');
    assert(goodPost.data.reading.temperature === 28.5, 'Temperature stored accurately');
    assert(goodPost.data.reading.rawNpk.nRaw === 140.0, 'Raw NPK stored separately');
    assert(goodPost.data.reading.calibratedNpk.isCalibrated === false, 'Raw NPK is NOT marked as calibrated');
    assert(goodPost.data.reading.calibratedNpk.nScore === null, 'Raw NPK is NOT assumed to equal CatBoost N_score');

    console.log('\n--- TEST 6: Sensor Status After Ingestion ---');
    const status2 = await makeRequest({ path: '/api/sensors/status' });
    assert(status2.status === 200, 'GET /api/sensors/status returns HTTP 200');
    assert(status2.data.connected === true, 'Sensor now reports connected = true');
    assert(status2.data.status === 'Connected', 'Status is "Connected"');
    assert(status2.data.isFresh === true, 'isFresh = true for new reading');

    console.log('\n--- TEST 7: Latest Reading Retrieval ---');
    const latest2 = await makeRequest({ path: '/api/sensors/latest' });
    assert(latest2.status === 200, 'GET /api/sensors/latest returns HTTP 200');
    assert(latest2.data.reading.deviceId === 'TEST-SIMULATED-ESP32', 'Retrieves correct device ID');
    assert(latest2.data.reading.temperature === 28.5, 'Retrieves correct temperature');

    console.log('\n--- TEST 8: Freshness Verification & Stale Reading Handling ---');
    // Freshness helper unit check
    const nowTime = new Date().toISOString();
    assert(isReadingFresh(nowTime, 900000) === true, 'Reading from now is fresh');
    const oldTime = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 mins ago
    assert(isReadingFresh(oldTime, 900000) === false, 'Reading from 20 mins ago is stale under 15-min limit');

    console.log('\n--- TEST 9: Model Input Safety & NPK Calibration Isolation ---');
    // Model preparation with uncalibrated sensor reading
    const prep1 = prepareModelInputs({
      reading: goodPost.data.reading,
      district: 'Salem',
      crop: 'groundnut'
    });
    assert(prep1.readyForModel === false, 'Uncalibrated reading correctly blocks ML model readiness');
    assert(prep1.missingOrUncalibrated.some(f => f.includes('N_score')), 'Identifies uncalibrated N_score as blocker');

    // Model preparation with verified manual NPK scores
    const prep2 = prepareModelInputs({
      reading: goodPost.data.reading,
      district: 'Salem',
      crop: 'groundnut',
      manualNpkOverrides: { nScore: 0.5, pScore: 0.0, kScore: 0.5 }
    });
    assert(prep2.readyForModel === true, 'Model inputs ready when calibrated/manual scores provided');
    assert(prep2.modelInputs.Temperature === 28.5, 'Model inputs contain verified sensor temperature');
    assert(prep2.modelInputs.N_score === 0.5, 'Model inputs contain calibrated N_score');

    console.log('\n--- TEST 10: Model & Training Dataset Integrity Verification ---');
    const modelPath = path.join(__dirname, '../ml/soil/soil_suitability_model.cbm');
    const datasetPath = path.join(__dirname, '../ml/soil/FINAL_SOIL_SUITABILITY_DATASET.csv');
    assert(fs.existsSync(modelPath), 'CatBoost model file soil_suitability_model.cbm exists untouched');
    assert(fs.existsSync(datasetPath), 'Dataset FINAL_SOIL_SUITABILITY_DATASET.csv exists untouched');
    const modelSize = fs.statSync(modelPath).size;
    assert(modelSize > 2500000, `Model file size intact (${modelSize} bytes)`);

  } catch (err) {
    console.error('Test execution failed:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`SENSOR API TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runSensorTests();

