const soilService = require('../src/Services/soilService');

async function runTests() {
  console.log('================================================================');
  console.log('🌱 RUNNING SMART COOP SOIL & CHATBOT SUITABILITY TEST SUITE');
  console.log('================================================================\n');

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

  // Test 1: Load and verify dataset statistics
  await soilService.ensureLoaded();
  assert(soilService.isLoaded, 'Dataset initialized and loaded');
  assert(soilService.cropsSet.size === 57, `57 crops verified (Got ${soilService.cropsSet.size})`);
  assert(soilService.districtsSet.size === 37, `37 districts verified (Got ${soilService.districtsSet.size})`);
  assert(!soilService.districtsSet.has('Chennai'), 'Chennai is NOT present in dataset (Verified)');

  // Test 2: groundnut + Salem
  const gnSalem = await soilService.getCropSuitability('groundnut', 'Salem');
  assert(gnSalem.success, 'Groundnut + Salem lookup successful');
  assert(gnSalem.avgSuitabilityScore > 75, `Groundnut in Salem is Suitable (Score: ${gnSalem.avgSuitabilityScore})`);
  assert(gnSalem.classification === 'Suitable', `Classification is "Suitable" (Got: ${gnSalem.classification})`);

  // Test 3: rice + Thanjavur
  const riceThanjavur = await soilService.getCropSuitability('rice', 'Thanjavur');
  assert(riceThanjavur.success, 'Rice + Thanjavur lookup successful');
  assert(riceThanjavur.cropRequirements.waterReq === 'High', `Rice water requirement is "High" (Got: ${riceThanjavur.cropRequirements.waterReq})`);

  // Test 4: Unknown crop
  const unknownCrop = await soilService.getCropSuitability('avocado_xyz', 'Salem');
  assert(!unknownCrop.success, 'Unknown crop handled gracefully with error message');

  // Test 5: Unknown district
  const unknownDist = await soilService.getCropSuitability('rice', 'Atlantis');
  assert(!unknownDist.success, 'Unknown district handled gracefully with error message');

  // Test 6: Chennai district check
  const chennaiCheck = await soilService.getCropSuitability('rice', 'Chennai');
  assert(!chennaiCheck.success && chennaiCheck.isChennai, 'Chennai specifically flagged as absent from NPK dataset');

  // Test 7: Water requirement (Categorical & Numeric handling)
  const waterRice = await soilService.getWaterRequirement('rice');
  assert(waterRice.success && !waterRice.formattedRequirement.includes('NaN'), `Water requirement for rice formatted without NaN ("${waterRice.formattedRequirement}")`);

  // Test 8: Climate query
  const climateRice = await soilService.getCropClimate('rice', 'Thanjavur');
  assert(climateRice.success && climateRice.cropRequirements.minTemperature > 0, `Crop climate retrieved (Temp Range: ${climateRice.cropRequirements.minTemperature}-${climateRice.cropRequirements.maxTemperature}°C)`);

  // Test 9: Crop Recommendation
  const recSalem = await soilService.getSuitableCrops('Salem');
  assert(recSalem.success && recSalem.topCrops.length > 0, `Crop recommendation for Salem returned ${recSalem.topCrops.length} ranked crops`);
  assert(recSalem.topCrops[0].avgSuitabilityScore >= recSalem.topCrops[recSalem.topCrops.length - 1].avgSuitabilityScore, 'Top crops properly sorted by suitability score descending');

  // Test 10: Manual soil suitability evaluation
  const manualEval = await soilService.checkManualSoilSuitability({
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
  assert(manualEval.success, 'Manual soil suitability evaluation successful');
  assert(manualEval.scores.overallSuitabilityScore > 75, `Manual score computed correctly (${manualEval.scores.overallSuitabilityScore}/100)`);
  assert(manualEval.classification === 'Suitable', `Manual evaluation classified as "${manualEval.classification}"`);
  assert(manualEval.strengths.length > 0, 'Key strengths identified in evaluation');

  // Test 11: Invalid / negative values rejection
  const invalidEval = await soilService.checkManualSoilSuitability({
    district: 'Salem',
    crop: 'groundnut',
    nitrogen: -10,
    phosphorus: 30,
    potassium: 40,
    temperature: 29,
    humidity: 150, // invalid humidity > 100
    moisture: 3.5
  });
  assert(!invalidEval.success, 'Invalid / negative / out-of-range sensor inputs rejected with error');

  // Test 12: Tamil aliases normalization
  const tamilCrop = soilService.normalizeCrop('நிலக்கடலை');
  assert(tamilCrop === 'groundnut', `Tamil crop "நிலக்கடலை" normalized to "groundnut" (Got: ${tamilCrop})`);

  const tamilDistrict = soilService.normalizeDistrict('சேலம்');
  assert(tamilDistrict.district === 'Salem', `Tamil district "சேலம்" normalized to "Salem" (Got: ${tamilDistrict.district})`);

  // Test 13: Tanglish aliases normalization
  const tanglishCrop = soilService.normalizeCrop('pachai payaru');
  assert(tanglishCrop === 'greengram', `Tanglish crop "pachai payaru" normalized to "greengram" (Got: ${tanglishCrop})`);

  const tanglishDistrict = soilService.normalizeDistrict('trichy');
  assert(tanglishDistrict.district === 'Tiruchirappalli', `Tanglish district "trichy" normalized to "Tiruchirappalli" (Got: ${tanglishDistrict.district})`);

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
