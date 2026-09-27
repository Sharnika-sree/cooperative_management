// PREDICTION FORM TESTS (final spec Tests 1-9 + shared-service checks)
// Part A: pure unit tests of the shared frontend form module
//         (frontend/src/services/predictionForm.js — zero dependencies).
// Part B: API flow tests of the exact payload the guided form submits.
require('dotenv').config();
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const soilService = require('../src/Services/soilService');
const mlSoilService = require('../src/Services/mlSoilService');
const chatbotRoutes = require('../src/routes/chatbot');

const PORT = process.env.TEST_PORT_FORM || 5097;
const LABELS = ['Suitable', 'Needs Improvement', 'Not Suitable'];

let passed = 0;
let failed = 0;
function assert(cond, name, extra) {
  if (cond) { console.log(`PASS ${name}`); passed++; }
  else { console.error(`FAIL ${name}${extra ? ' :: ' + extra : ''}`); failed++; }
}

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
          { id: 't', email: 'f@t.c', name: 'x', role: 'FARMER' },
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

async function run() {
  // ================= PART A: shared form module units =================
  const form = await import('../../frontend/src/services/predictionForm.js');
  const FULL = { district: 'Salem', crop: 'groundnut', temperature: '35', humidity: '40', moisture: '30', n: '0.5', p: '0', k: '0.5' };

  // A1: empty form -> incomplete, all 8 missing
  let v = form.validatePredictionForm(form.emptyPredictionForm(), 'English');
  assert(v.complete === false && v.missing.length === 8, 'A1 empty form incomplete, 8 missing', JSON.stringify(v.missing));

  // A2 (spec Test 2): K empty -> Predict blocked + "K Value is required"
  const missingK = { ...FULL, k: '' };
  v = form.validatePredictionForm(missingK, 'English');
  assert(v.complete === false, 'A2 K-empty form incomplete (Predict disabled)');
  assert(v.errors.k === 'K Value is required before prediction.', 'A2 K missing message', v.errors.k);

  // A3: complete form validates
  v = form.validatePredictionForm(FULL, 'English');
  assert(v.complete === true && Object.keys(v.errors).length === 0, 'A3 complete form valid');

  // A4 (spec Test 4): Temperature "abc" -> field-specific error, NPK not blamed
  v = form.validatePredictionForm({ ...FULL, temperature: 'abc' }, 'English');
  assert(v.complete === false && v.errors.temperature === 'Temperature must be a valid number.', 'A4 Temperature abc field error', JSON.stringify(v.errors));
  assert(!v.errors.n && !v.errors.p && !v.errors.k, 'A4 NPK not blamed');

  // A5: NPK outside model contract rejected with field-specific message
  v = form.validatePredictionForm({ ...FULL, n: '2' }, 'English');
  assert(v.complete === false && v.errors.n === 'N Value must be 0, 0.5, or 1.', 'A5 N=2 rejected', v.errors.n);

  // A6 (spec Test 5): Tamil strings fully Tamil, placeholders localized
  const TS = form.formStrings('Tamil');
  assert(TS.district === 'மாவட்டம்' && TS.predict === 'கணி' && TS.ph_temperature === 'எடுத்துக்காட்டு: 35', 'A6 Tamil UI strings');
  assert(/[\u0B80-\u0BFF]/.test(TS.formSubtitle), 'A6 Tamil subtitle in Tamil script');
  const ES = form.formStrings('English');
  assert(!/[\u0B80-\u0BFF]/.test(ES.formTitle + ES.predict + ES.ph_temperature), 'A6 English UI has no Tamil script');

  // A7 (spec Test 7): voice transcript fills the form deterministically
  let pf = form.parseTranscriptToForm('Salem groundnut 35 40 30 zero point five zero zero point five', form.emptyPredictionForm());
  assert(pf.temperature === '35' && pf.humidity === '40' && pf.moisture === '30' && pf.n === '0.5' && pf.p === '0' && pf.k === '0.5', 'A7 voice numbers fill form', JSON.stringify(pf));
  pf = form.parseTranscriptToForm('Temperature 35 Humidity 40', form.emptyPredictionForm());
  assert(pf.temperature === '35' && pf.humidity === '40' && pf.n === '', 'A7 labeled voice values fill form, rest untouched');

  // A8: message builder produces the exact labeled payload
  const msg = form.buildPredictionMessage(FULL);
  assert(msg === 'District: Salem Crop: groundnut Temperature: 35 Humidity: 40 Moisture: 30 N: 0.5 P: 0 K: 0.5', 'A8 exact labeled payload', msg);

  // ================= PART B: API flow of the form payload =================
  await soilService.ensureLoaded();
  const EXPECTED = mlSoilService.runDecisionEngine({
    district_name: 'Salem', CROPS: 'groundnut', Temperature: 35, Humidity: 40,
    Moisture: 30, N_score: 0.5, P_score: 0, K_score: 0.5
  });
  const app = express();
  app.use(express.json());
  app.use('/api/chatbot', chatbotRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(PORT, () => resolve(s)); });

  try {
    // B1 (spec Test 1): entering prediction mode shows the 8-field guided prompt
    let t = await chat('Soil Prediction', null, 'prediction');
    assert(t.res.status === 200 && /District/.test(t.text) && /Crop/.test(t.text) && /Temperature/.test(t.text) && /Humidity/.test(t.text) && /Moisture/.test(t.text) && /N/.test(t.text) && /P/.test(t.text) && /K/.test(t.text), 'B1 guided 8-field prompt');
    assert(t.calls === 0, 'B1 no model call on mode entry');

    // B2 (spec Test 2): 7 of 8 via API -> blocked asking K
    t = await chat('Soil Prediction', null, 'prediction');
    t = await chat('District: Salem Crop: Groundnut Temperature: 35 Humidity: 40 Moisture: 30 N: 0.5 P: 0', t.mem, 'prediction');
    assert(t.calls === 0 && !LABELS.some((l) => t.text.includes(l)) && /\bK\b/.test(t.text), 'B2 missing K blocked', t.text.slice(0, 160));

    // B3 (spec Test 3): full form payload -> ONE call, real label, farmer report
    t = await chat('Soil Prediction', null, 'prediction');
    t = await chat('District: Salem Crop: Groundnut Temperature: 35 Humidity: 40 Moisture: 30 N: 0.5 P: 0 K: 0.5', t.mem, 'prediction');
    assert(t.calls === 1, 'B3 exactly ONE model call', `calls=${t.calls}`);
    assert(t.res.data.soilResult && t.res.data.soilResult.prediction === EXPECTED.prediction, 'B3 actual model label', `got=${t.res.data.soilResult && t.res.data.soilResult.prediction}`);
    assert(/Soil Suitability Report|Soil & Crop Suitability/.test(t.text) && /Final Result|Result/.test(t.text), 'B3 farmer-friendly report');
    assert(!/CatBoost|Accuracy|F1 Score|Precision|Recall|confidence/i.test(t.text), 'B3 no ML jargon in report');

    // B4 (spec Test 4): Temperature abc via API -> asks Temperature, 0 calls
    t = await chat('Soil Prediction', null, 'prediction');
    t = await chat('District: Salem Crop: Groundnut Temperature: abc Humidity: 40 Moisture: 30 N: 0.5 P: 0 K: 0.5', t.mem, 'prediction');
    assert(t.calls === 0 && /Temperature/.test(t.text) && !LABELS.some((l) => t.text.includes(l)), 'B4 invalid Temperature blocked', t.text.slice(0, 160));

    // B5 (spec Test 5): Tamil complete payload -> fully Tamil report
    t = await chat('Soil Prediction', null, 'prediction', 'Tamil');
    t = await chat('District: Salem Crop: Groundnut Temperature: 35 Humidity: 40 Moisture: 30 N: 0.5 P: 0 K: 0.5', t.mem, 'prediction', 'Tamil');
    assert(t.calls === 1, 'B5 Tamil prediction calls model once');
    assert(/[\u0B80-\u0BFF]/.test(t.text) && !/Soil Suitability Report/.test(t.text), 'B5 fully Tamil report');

    // B6 (spec Test 6): English complete payload -> fully English report
    t = await chat('Soil Prediction', null, 'prediction', 'English');
    t = await chat('District: Salem Crop: Groundnut Temperature: 35 Humidity: 40 Moisture: 30 N: 0.5 P: 0 K: 0.5', t.mem, 'prediction', 'English');
    assert(!/[\u0B80-\u0BFF]/.test(t.text) && /Crop/.test(t.text), 'B6 fully English report');

    // B9 (spec Test 9): normal-mode general question -> no form, no call
    t = await chat('What is the preferred humidity for Rice?', null, 'normal');
    assert(t.calls === 0 && !/District/.test(t.text), 'B9 normal answer, no prediction form, no ML call');
  } finally {
    server.close();
    console.log = origLog;
    console.log(`\nFORM SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

run().catch((e) => { console.log = origLog; console.error('Fatal:', e); process.exit(1); });
