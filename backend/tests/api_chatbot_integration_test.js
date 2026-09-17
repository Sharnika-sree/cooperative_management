const http = require('http');
const jwt = require('jsonwebtoken');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runApiIntegrationTests() {
  console.log('================================================================');
  console.log('🌐 RUNNING API & CHATBOT HTTP INTEGRATION TESTS');
  console.log('================================================================\n');

  const token = jwt.sign(
    { id: 'test-user-id', email: 'farmer@smartcoop.test', name: 'Ravi Kumar', role: 'FARMER' },
    'cooperative_secret_key_change_in_production'
  );

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

  // 1. GET /api/soil/suitability
  const suitRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/soil/suitability?crop=groundnut&district=Salem',
    method: 'GET'
  });
  assert(suitRes.status === 200 && suitRes.data.success, 'GET /api/soil/suitability returns 200 OK');

  // 2. GET /api/soil/water
  const waterRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/soil/water?crop=rice&district=Thanjavur',
    method: 'GET'
  });
  assert(waterRes.status === 200 && waterRes.data.waterRequirement === 'High', 'GET /api/soil/water returns water requirement');

  // 3. GET /api/soil/climate
  const climateRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/soil/climate?crop=rice&district=Thanjavur',
    method: 'GET'
  });
  assert(climateRes.status === 200 && climateRes.data.cropRequirements.minTemperature > 0, 'GET /api/soil/climate returns climate data');

  // 4. GET /api/soil/crops
  const cropsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/soil/crops?district=Salem',
    method: 'GET'
  });
  assert(cropsRes.status === 200 && cropsRes.data.topCrops.length > 0, 'GET /api/soil/crops returns ranked crops');

  // 5. POST /api/soil/check
  const checkRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/soil/check',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    district: 'Salem',
    soilType: 'Red Soil',
    crop: 'groundnut',
    nitrogen: 45,
    phosphorus: 30,
    potassium: 40,
    temperature: 29,
    humidity: 70,
    moisture: 3.5
  });
  assert(checkRes.status === 200 && checkRes.data.classification === 'Suitable', 'POST /api/soil/check evaluates suitability score');

  // 6. POST /api/iot/sensor-data & GET /api/iot/latest/:deviceId
  const iotPostRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/iot/sensor-data',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    deviceId: 'SOIL-001',
    nitrogen: 48,
    phosphorus: 32,
    potassium: 42,
    temperature: 28.5,
    humidity: 68.0,
    moisture: 4.0
  });
  assert(iotPostRes.status === 201 && iotPostRes.data.success, 'POST /api/iot/sensor-data records sensor reading');

  const iotGetRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/iot/latest/SOIL-001',
    method: 'GET'
  });
  assert(iotGetRes.status === 200 && iotGetRes.data.nitrogen === 48, 'GET /api/iot/latest/SOIL-001 retrieves recorded sensor telemetry');

  // 7. Chatbot: Crop recommendation in English
  const chatRec = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/chatbot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { message: 'What crop is suitable in Salem?' });
  assert(chatRec.status === 200 && chatRec.data.response.includes('Salem'), 'Chatbot handles "What crop is suitable in Salem?"');

  // 8. Chatbot: Water requirement in English
  const chatWater = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/chatbot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { message: 'What is the water requirement for rice in Thanjavur?' });
  assert(chatWater.status === 200 && chatWater.data.response.includes('water requirement'), 'Chatbot handles "What is the water requirement for rice in Thanjavur?"');

  // 9. Chatbot: Soil suitability in English
  const chatSuit = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/chatbot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { message: 'Is groundnut suitable for Salem?' });
  assert(chatSuit.status === 200 && chatSuit.data.response.includes('Suitability'), 'Chatbot handles "Is groundnut suitable for Salem?"');

  // 10. Chatbot: Manual values evaluation
  const chatManual = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/chatbot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { message: 'My N is 45, P is 30, K is 40, temperature is 29, humidity is 70 and moisture is 3. Is groundnut suitable?' });
  assert(chatManual.status === 200 && chatManual.data.response.includes('Suitability Score'), 'Chatbot parses manual NPK/climate values and returns structured score');

  // 11. Chatbot: Tamil query
  const chatTamil = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/chatbot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { message: 'சேலத்தில் எந்த பயிர் ஏற்றது?' });
  assert(chatTamil.status === 200 && /[\u0B80-\u0BFF]/.test(chatTamil.data.response), 'Chatbot answers Tamil question in Tamil');

  // 12. Chatbot: Tanglish query
  const chatTanglish = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/chatbot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { message: 'Salem la enna crop suitable?' });
  assert(chatTanglish.status === 200 && chatTanglish.data.response.includes('Salem'), 'Chatbot understands Tanglish "Salem la enna crop suitable?"');

  // 13. Chatbot: Existing Cooperative question
  const chatCoop = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/chatbot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { message: 'Is urea available?' });
  assert(chatCoop.status === 200 && (chatCoop.data.response.includes('Urea') || chatCoop.data.response.includes('inventory')), 'Chatbot answers existing cooperative question "Is urea available?"');

  console.log('\n================================================================');
  console.log(`HTTP INTEGRATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runApiIntegrationTests().catch(err => {
  console.error('Integration test runner error:', err);
  process.exit(1);
});
