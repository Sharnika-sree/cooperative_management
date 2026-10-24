// TWO-MODE CHATBOT TESTS (spec Tests 1-22)
// Verifies explicit Normal vs Soil-Prediction separation around the EXISTING
// CatBoost model. Model/dataset are never modified here.
// Model calls are counted via the server-side '[SOIL MODEL CALL]' log line.
require('dotenv').config();
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const soilService = require('../src/Services/soilService');
const mlSoilService = require('../src/Services/mlSoilService');
const chatbotRoutes = require('../src/routes/chatbot');

const PORT = process.env.TEST_PORT_TWO_MODE || 5098;
const LABELS = ['Suitable', 'Needs Improvement', 'Not Suitable'];

let modelCalls = 0;
const origLog = console.log;
console.log = (...args) => {
  try {
    if (typeof args[0] === 'string' && args[0].startsWith('[SOIL MODEL CALL]')) modelCalls++;
  } catch (e) { /* ignore */ }
  return origLog(...args);
};

function makeRequest(postData) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(postData);
    const req = http.request({
      hostname: '127.0.0.1', port: PORT, path: '/api/chatbot', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: 'Bearer ' + jwt.sign(
          { id: 'test-user-id', email: 'farmer@smartcoop.test', name: 'Ravi', role: 'FARMER' },
          process.env.JWT_SECRET || 'cooperative_secret_key_change_in_production'
        )
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, text: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function chat(message, mem, mode, language) {
  modelCalls = 0;
  const r = await makeRequest({ message, language: language || 'English', mode, sessionMemory: mem || null });
  return { res: r, calls: modelCalls, text: (r.data && r.data.response) || '', mem: (r.data && r.data.sessionMemory) || null };
}

let passed = 0;
let failed = 0;
function assert(cond, name, extra) {
  if (cond) { console.log(`PASS ${name}`); passed++; }
  else { console.error(`FAIL ${name}${extra ? ' :: ' + extra : ''}`); failed++; }
}
const hasLabel = (t) => LABELS.some((l) => t.includes(l));
const hasRice = (t) => /rice/i.test(t);

async function run() {
  await soilService.ensureLoaded();
  // Pre-compute expected labels via the REAL engine BEFORE the test server
  // starts (direct spawn + live server sockets must not interleave).
  const FULL_FEATURES = {
    district_name: 'Salem', CROPS: 'groundnut', Temperature: 35, Humidity: 40,
    Moisture: 30, N_score: 0.5, P_score: 0, K_score: 0.5
  };
  const EXPECTED_FULL = mlSoilService.runDecisionEngine({ ...FULL_FEATURES });
  if (!EXPECTED_FULL || !EXPECTED_FULL.prediction) {
    console.error('FATAL: direct engine call failed', JSON.stringify(EXPECTED_FULL));
    process.exit(1);
  }
  origLog('Direct engine reference label:', EXPECTED_FULL.prediction);
  const app = express();
  app.use(express.json());
  app.use('/api/chatbot', chatbotRoutes);
  const server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });

  try {
    // ---- TEST 1: NEW PREDICTION (Groundnut Salem -> ask 6 numerics, 0 calls)
    let t = await chat('Soil Prediction', null, 'prediction');
    assert(t.res.status === 200, 'T1 start returns 200');
    t = await chat('Groundnut Salem', t.mem, 'prediction');
    assert(t.calls === 0, 'T1 modelCallCount = 0', `calls=${t.calls}`);
    assert(/Temperature/.test(t.text) && /Humidity/.test(t.text) && /Moisture/.test(t.text) && /N/.test(t.text) && /P/.test(t.text) && /K/.test(t.text), 'T1 asks for T/H/M/N/P/K');
    assert(!hasLabel(t.text), 'T1 no prediction label');
    const mem1 = t.mem;

    // ---- TEST 2: ONLY ONE VALUE (Temperature 35)
    t = await chat('Temperature 35', mem1, 'prediction');
    assert(t.calls === 0, 'T2 modelCallCount = 0', `calls=${t.calls}`);
    assert(/Humidity/.test(t.text) && /Moisture/.test(t.text) && /\bN\b/.test(t.text) && /\bP\b/.test(t.text) && /\bK\b/.test(t.text), 'T2 asks for remaining H/M/N/P/K', t.text.slice(0, 200));
    assert(/35/.test(t.text), 'T2 acknowledges recorded Temperature');
    assert(!hasLabel(t.text), 'T2 no Suitable/Needs Improvement/Not Suitable');
    assert(!hasRice(t.text), 'T2 no Rice fallback');

    // ---- TEST 3: COMPLETE UNLABELED INPUT (40 30 0.5 0 0.5)
    t = await chat('40 30 0.5 0 0.5', t.mem, 'prediction');
    assert(t.calls === 1, 'T3 exactly ONE model call', `calls=${t.calls}`);
    assert(t.res.data.soilResult && t.res.data.soilResult.prediction === EXPECTED_FULL.prediction, 'T3 actual model label returned', `got=${t.res.data.soilResult && t.res.data.soilResult.prediction} expected=${EXPECTED_FULL.prediction}`);
    const lc = t.mem && t.mem.lastCompletedInputs;
    assert(lc && lc.district_name === 'Salem' && lc.CROPS === 'groundnut' && lc.Temperature === 35 && lc.Humidity === 40 && lc.Moisture === 30 && lc.N_score === 0.5 && lc.P_score === 0 && lc.K_score === 0.5, 'T3 exact feature mapping', JSON.stringify(lc));

    // ---- TEST 4: SIX UNLABELED FROM SCRATCH
    let s = await chat('Soil Prediction', null, 'prediction');
    s = await chat('Groundnut Salem', s.mem, 'prediction');
    t = await chat('35 40 30 0.5 0 0.5', s.mem, 'prediction');
    assert(t.calls === 1, 'T4 exactly ONE model call', `calls=${t.calls}`);
    assert(t.res.data.soilResult && t.res.data.soilResult.prediction === EXPECTED_FULL.prediction, 'T4 actual label, no missing-input message');

    // ---- TEST 5: MISSING K
    s = await chat('Soil Prediction', null, 'prediction');
    s = await chat('Groundnut Salem', s.mem, 'prediction');
    t = await chat('35 40 30 0.5 0', s.mem, 'prediction');
    assert(t.calls === 0, 'T5 NO model call', `calls=${t.calls}`);
    assert(!hasLabel(t.text) && /\bK\b/.test(t.text), 'T5 K value required', t.text.slice(0, 200));

    // ---- TEST 6: MISSING P
    s = await chat('Soil Prediction', null, 'prediction');
    s = await chat('Groundnut Salem', s.mem, 'prediction');
    t = await chat('35 40 30 0.5', s.mem, 'prediction');
    assert(t.calls === 0, 'T6 NO model call', `calls=${t.calls}`);
    assert(!hasLabel(t.text) && /\bP\b/.test(t.text) && /\bK\b/.test(t.text), 'T6 asks for P and K');

    // ---- TEST 7/8/9: OUT-OF-RANGE N/P/K
    s = await chat('Soil Prediction', null, 'prediction');
    s = await chat('Groundnut Salem', s.mem, 'prediction');
    t = await chat('35 40 30 101 0 0.5', s.mem, 'prediction');
    assert(t.calls === 0 && !hasLabel(t.text) && /N must be between 0 and 100\./.test(t.text), 'T7 reject N=101', t.text.slice(0, 160));
    t = await chat('35 40 30 0.5 -1 0.5', s.mem, 'prediction');
    assert(t.calls === 0 && !hasLabel(t.text) && /P must be between 0 and 100\./.test(t.text), 'T8 reject P=-1');
    t = await chat('35 40 30 0.5 0 150', s.mem, 'prediction');
    assert(t.calls === 0 && !hasLabel(t.text) && /K must be between 0 and 100\./.test(t.text), 'T9 reject K=150');

    // ---- TEST 10: NEW PREDICTION DOES NOT REUSE OLD VALUES
    let f = await chat('Soil Prediction', null, 'prediction');
    f = await chat('District: Salem Crop: Groundnut Temperature: 35 Humidity: 40 Moisture: 30 N: 0.5 P: 0 K: 0.5', f.mem, 'prediction');
    assert(f.calls === 1 && hasLabel(f.text), 'T10 first prediction completes');
    const prevInputs = f.mem.lastCompletedInputs;
    f = await chat('Start New Prediction', f.mem, 'prediction');
    f = await chat('Rice Coimbatore', f.mem, 'prediction');
    assert(f.calls === 0, 'T10 no model call after new crop/district');
    const ps = f.mem && (f.mem.prediction || f.mem.predictionSession);
    const numsNull = ps && (ps.Temperature === null || ps.Temperature === undefined) && (ps.Humidity === null || ps.Humidity === undefined) && (ps.Moisture === null || ps.Moisture === undefined) && (ps.N_score === null || ps.N_score === undefined) && (ps.P_score === null || ps.P_score === undefined) && (ps.K_score === null || ps.K_score === undefined);
    assert(numsNull === true, 'T10 numerics reset to null', JSON.stringify(ps));
    assert(f.mem.lastCompletedInputs && f.mem.lastCompletedInputs.CROPS === 'groundnut', 'T10 old completed inputs preserved separately');

    // ---- TEST 11: NORMAL QUESTION (humidity Rice) — no model, no 8-input demand
    t = await chat('What is the preferred humidity for Rice?', null, 'normal');
    assert(t.calls === 0, 'T11 modelCallCount = 0', `calls=${t.calls}`);
    assert(!/Temperature[\s\S]*Humidity[\s\S]*Moisture[\s\S]*N score/.test(t.text) || /Preferred Humidity Range/.test(t.text), 'T11 normal agri answer');

    // ---- TEST 12: NORMAL fertilizer question — no prediction flow
    t = await chat('What fertilizer is suitable for Groundnut?', null, 'normal');
    assert(t.calls === 0, 'T12 modelCallCount = 0', `calls=${t.calls}`);
    assert(!/Please provide/.test(t.text) || hasLabel(t.text) === false, 'T12 no 8-input demand');

    // ---- TEST 13: NORMAL requirements Rice — verified info, no prediction
    t = await chat('What are the requirements for Rice?', null, 'normal');
    assert(t.calls === 0 && !/Soil & Crop Suitability/.test(t.text), 'T13 no soil prediction');

    // ---- TEST 14/15: PREDICTION PRIORITY + NO RICE FALLBACK
    s = await chat('Soil Prediction', null, 'prediction');
    s = await chat('Groundnut Salem', s.mem, 'prediction');
    t = await chat('Temperature 35', s.mem, 'prediction');
    assert(t.calls === 0 && /35/.test(t.text) && /Humidity/.test(t.text), 'T14 parsed as prediction input');
    assert(!hasRice(t.text), 'T15 no Rice response', t.text.slice(0, 200));

    // ---- TEST 16: FULL LABELED INPUT one-shot
    s = await chat('Soil Prediction', null, 'prediction');
    t = await chat('District: Salem Crop: Groundnut Temperature: 35 Humidity: 40 Moisture: 30 N: 0.5 P: 0 K: 0.5', s.mem, 'prediction');
    assert(t.calls === 1, 'T16 exactly ONE model call', `calls=${t.calls}`);
    assert(t.res.data.soilResult && t.res.data.soilResult.prediction === EXPECTED_FULL.prediction, 'T16 actual label returned');

    // ---- TEST 17: UNSUPPORTED CROP
    s = await chat('Soil Prediction', null, 'prediction');
    t = await chat('Dragon Fruit Salem 35 40 30 0.5 0 0.5', s.mem, 'prediction');
    assert(t.calls === 0 && /not supported by the current soil prediction model/.test(t.text), 'T17 unsupported crop rejected', t.text.slice(0, 160));

    // ---- TEST 18: UNSUPPORTED DISTRICT (Chennai)
    s = await chat('Soil Prediction', null, 'prediction');
    t = await chat('Rice Chennai 30 60 30 0.5 0.5 0.5', s.mem, 'prediction');
    assert(t.calls === 0 && /not supported by the current soil prediction model/.test(t.text), 'T18 unsupported district rejected');

    // ---- TEST 19: NORMAL AFTER PREDICTION
    f = await chat('Soil Prediction', null, 'prediction');
    f = await chat('District: Salem Crop: Groundnut Temperature: 35 Humidity: 40 Moisture: 30 N: 0.5 P: 0 K: 0.5', f.mem, 'prediction');
    assert(f.calls === 1, 'T19 setup prediction completes');
    t = await chat('What is the preferred temperature for Rice?', null, 'normal');
    assert(t.calls === 0 && !/Soil & Crop Suitability/.test(t.text), 'T19 normal answer, no interference');

    // ---- TEST 20: VOICE PREDICTION (transcribed text incl. number words)
    s = await chat('Soil Prediction', null, 'prediction');
    t = await chat('Salem groundnut 35 40 30 zero point five zero zero point five', s.mem, 'prediction');
    assert(t.calls === 1, 'T20 voice-style input parsed, ONE call', `calls=${t.calls} :: ${t.text.slice(0, 200)}`);
    assert(t.res.data.soilResult && t.res.data.soilResult.prediction === EXPECTED_FULL.prediction, 'T20 actual label');

    // ---- TEST 21: VOICE NORMAL QUESTION
    t = await chat('What is the preferred humidity for Rice?', null, 'normal');
    assert(t.calls === 0, 'T21 normal voice question, no model call');

    // ---- TEST 22: DUPLICATE RESPONSE (exactly one assistant message)
    s = await chat('Soil Prediction', null, 'prediction');
    s = await chat('Groundnut Salem', s.mem, 'prediction');
    t = await chat('Temperature 35', s.mem, 'prediction');
    assert(t.res.status === 200 && typeof t.text === 'string' && t.text.length > 0, 'T22 single assistant response');
    const cardCount = (t.text.match(/Soil & Crop Suitability/g) || []).length;
    assert(cardCount <= 1, 'T22 at most one result card', `cards=${cardCount}`);

    // ---- MANUAL FLOW (spec section 32)
    let m = await chat('Soil Prediction', null, 'prediction');
    m = await chat('Groundnut Salem', m.mem, 'prediction');
    assert(m.calls === 0 && /Temperature/.test(m.text), 'MANUAL step1 asks numerics');
    m = await chat('Temperature 35', m.mem, 'prediction');
    assert(m.calls === 0 && !hasLabel(m.text) && /Humidity/.test(m.text), 'MANUAL step2 ack, NO prediction', m.text.slice(0, 220));
    m = await chat('Humidity 40 Moisture 30 N 0.5 P 0 K 0.5', m.mem, 'prediction');
    assert(m.calls === 1, 'MANUAL step3 ONE model call', `calls=${m.calls}`);
    assert(m.res.data.soilResult && m.res.data.soilResult.prediction === EXPECTED_FULL.prediction, 'MANUAL actual label');
    const mlc = m.mem && m.mem.lastCompletedInputs;
    assert(mlc && JSON.stringify({ district_name: mlc.district_name, CROPS: mlc.CROPS, Temperature: mlc.Temperature, Humidity: mlc.Humidity, Moisture: mlc.Moisture, N_score: mlc.N_score, P_score: mlc.P_score, K_score: mlc.K_score }) === JSON.stringify({ district_name: 'Salem', CROPS: 'groundnut', Temperature: 35, Humidity: 40, Moisture: 30, N_score: 0.5, P_score: 0, K_score: 0.5 }), 'MANUAL exact model input');
  } finally {
    server.close();
    console.log = origLog;
    console.log(`\nTWO-MODE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

run().catch((e) => { console.log = origLog; console.error('Fatal:', e); process.exit(1); });
