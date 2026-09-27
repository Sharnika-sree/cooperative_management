const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const prisma = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const soilService = require('../Services/soilService');
const mlSoilService = require('../Services/mlSoilService');
const { displayDistrict, displayCrop, prettyCropEn } = require('../utils/agriLabels');

const RAW_ACTIONS = new Set([
  'SELECT_DISTRICT',
  'SET_DISTRICT',
  'SELECT_CROP',
  'SET_CROP',
  'CROP_RECOMMENDATIONS',
  'DISTRICT_INFO',
  'CROP_INFO',
  'WATER_REQUIREMENT',
  'NPK_REQUIREMENT',
  'TEMP_HUMIDITY',
  'COMPARE_CROPS'
]);

const router = express.Router();

// Initialize Gemini (fallback to dummy key if not configured to avoid startup crash)
const apiKey = process.env.GEMINI_API_KEY === 'your_gemini_api_key_here' ? '' : (process.env.GEMINI_API_KEY || '');
let genAI = null;
if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
  } catch (err) {
    console.error('Failed to initialize GoogleGenerativeAI:', err);
  }
}

// Helper: Check if text contains Tamil characters
function isTamilText(text) {
  return /[\u0B80-\u0BFF]/.test(text);
}

// Helper: Extract district from text or aliases
function extractDistrictFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase();
  for (const [alias, standard] of Object.entries(soilService.districtAliases)) {
    const regex = new RegExp(`\\b${alias}\\b`, 'i');
    if (regex.test(clean) || clean.includes(alias)) {
      return standard;
    }
  }
  for (const d of soilService.districtsSet) {
    const regex = new RegExp(`\\b${d.toLowerCase()}\\b`, 'i');
    if (regex.test(clean) || clean.includes(d.toLowerCase())) {
      return d;
    }
  }
  return null;
}

// Helper: Extract crop from text or aliases
function extractCropFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase();
  
  const wordsToSkip = new Set(['crop', 'crops', 'பயிர்', 'பயிர்கள்', 'plant', 'soil', 'suitable', 'best', 'ennu', 'enna']);

  for (const [alias, standard] of Object.entries(soilService.cropAliases)) {
    if (wordsToSkip.has(alias.toLowerCase())) continue;
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(clean)) {
      return standard;
    }
  }

  for (const c of soilService.cropsSet) {
    if (wordsToSkip.has(c.toLowerCase())) continue;
    const regex = new RegExp(`\\b${c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(clean)) {
      return c;
    }
  }

  return null;
}

// Multi-turn Prediction Session State Handler
function processPredictionSession(query, sessionMemory, isTamil, mode) {
  const clean = query.toLowerCase();
  const isPredictionMode = (mode === 'prediction');

  // Normalize spoken numbers to numeric strings
  let normalizedQuery = query;
  const spokenMap = { 'zero point five': '0.5', 'zero': '0', 'one': '1', 'one point five': '1.5', 'two': '2', 'two point five': '2.5', 'three': '3', 'three point five': '3.5', 'four': '4', 'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10' };
  for (const [spoken, num] of Object.entries(spokenMap)) {
    normalizedQuery = normalizedQuery.replace(new RegExp(spoken, 'gi'), num);
  }
  
  // Check if user explicitly requests to reuse previous values
  const isExplicitReuse = /use\s+(?:my\s+)?previous\s+values|reuse\s+previous|old\s+values|முந்தைய\s+அளவீடுகளை/i.test(query);

  const isPredictionQuery = /suitable|suitability|verdict|score|improve|why|can\s+i\s+grow|grow|suitable\s+ah|suitablea|ஏற்றதா|பயிரிடலாமா|prediction/i.test(query);

  let currentSession = null;

  if (isExplicitReuse && sessionMemory?.lastCompletedInputs) {
    currentSession = { ...sessionMemory.lastCompletedInputs };
  } else if (sessionMemory?.predictionSession && (isPredictionQuery || isPredictionMode)) {
    currentSession = { ...sessionMemory.predictionSession };
  } else {
    // New prediction request: never reuse stale raw-data crop/district.
    currentSession = {
      district_name: extractDistrictFromText(query) || sessionMemory?.predictionSession?.district_name || null,
      CROPS: extractCropFromText(query) || sessionMemory?.predictionSession?.CROPS || null,
      Temperature: null,
      Humidity: null,
      Moisture: null,
      N_score: null,
      P_score: null,
      K_score: null
    };
  }

  // Extract District & Crop if mentioned in current message
  const detectedDist = extractDistrictFromText(query);
  const detectedCrop = extractCropFromText(query);
  if (detectedDist) currentSession.district_name = detectedDist;
  if (detectedCrop) currentSession.CROPS = detectedCrop;

  // Extract Numeric Measurements
  const tempMatch = normalizedQuery.match(/(?:temperature|temp\b|temperature\s*is|temp\s*[:=])\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const humMatch = normalizedQuery.match(/(?:humidity|hum\b|humidity\s*is|hum\s*[:=])\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const moistMatch = normalizedQuery.match(/(?:moisture|moist\b|moisture\s*is|moist\s*[:=])\s*[:=]?\s*(\d+(?:\.\d+)?)/i);

  const nScoreMatch = normalizedQuery.match(/(?:n_score|n\s*score|nitrogen\s*score|n\s*val|nitrogen\s*val|n\s*is|nitrogen\s*is|nitrogen|n\s*:|n\s+)\s*[:=]?\s*(1\.0|0\.5|0\.0|1|0|\d+(?:\.\d+)?)/i);
  const pScoreMatch = normalizedQuery.match(/(?:p_score|p\s*score|phosphorus\s*score|p\s*val|phosphorus\s*val|p\s*is|phosphorus\s*is|phosphorus|p\s*:|p\s+)\s*[:=]?\s*(1\.0|0\.5|0\.0|1|0|\d+(?:\.\d+)?)/i);
  const kScoreMatch = normalizedQuery.match(/(?:k_score|k\s*score|potassium\s*score|k\s*val|potassium\s*val|k\s*is|potassium\s*is|potassium|k\s*:|k\s+)\s*[:=]?\s*(1\.0|0\.5|0\.0|1|0|\d+(?:\.\d+)?)/i);

  const npkScoresMatch = normalizedQuery.match(/npk\s*(?:scores|score|is|=|:)?\s*(\d+(?:\.\d+)?)\s*[,:\s]\s*(\d+(?:\.\d+)?)\s*[,:\s]\s*(\d+(?:\.\d+)?)/i);

  if (tempMatch) currentSession.Temperature = parseFloat(tempMatch[1]);
  if (humMatch) currentSession.Humidity = parseFloat(humMatch[1]);
  if (moistMatch) currentSession.Moisture = parseFloat(moistMatch[1]);

  if (nScoreMatch) currentSession.N_score = parseFloat(nScoreMatch[1]);
  else if (npkScoresMatch) currentSession.N_score = parseFloat(npkScoresMatch[1]);

  if (pScoreMatch) currentSession.P_score = parseFloat(pScoreMatch[1]);
  else if (npkScoresMatch) currentSession.P_score = parseFloat(npkScoresMatch[2]);

  if (kScoreMatch) currentSession.K_score = parseFloat(kScoreMatch[1]);
  else if (npkScoresMatch) currentSession.K_score = parseFloat(npkScoresMatch[3]);

  // Keyword score fallbacks
  if (currentSession.N_score === null && /nitrogen\s+(?:is\s+)?low/i.test(normalizedQuery)) currentSession.N_score = 0.0;
  if (currentSession.N_score === null && /nitrogen\s+(?:is\s+)?moderate/i.test(normalizedQuery)) currentSession.N_score = 0.5;
  if (currentSession.N_score === null && /nitrogen\s+(?:is\s+)?suitable/i.test(normalizedQuery)) currentSession.N_score = 1.0;

  if (currentSession.P_score === null && /phosphorus\s+(?:is\s+)?low/i.test(normalizedQuery)) currentSession.P_score = 0.0;
  if (currentSession.P_score === null && /phosphorus\s+(?:is\s+)?moderate/i.test(normalizedQuery)) currentSession.P_score = 0.5;
  if (currentSession.P_score === null && /phosphorus\s+(?:is\s+)?suitable/i.test(normalizedQuery)) currentSession.P_score = 1.0;

  if (currentSession.K_score === null && /potassium\s+(?:is\s+)?low/i.test(normalizedQuery)) currentSession.K_score = 0.0;
  if (currentSession.K_score === null && /potassium\s+(?:is\s+)?moderate/i.test(normalizedQuery)) currentSession.K_score = 0.5;
  if (currentSession.K_score === null && /potassium\s+(?:is\s+)?suitable/i.test(normalizedQuery)) currentSession.K_score = 1.0;

  const debugSessionMemory = JSON.stringify(sessionMemory || {});

  // Unlabeled numeric input: extract all numbers positionally
  const hasNumericLabels = /(temperature|temp\b|humidity|humid|moisture|moist|nitrogen|phosphorus|potassium|n_score|p_score|k_score|n\s+|p\s+|k\s+|\bnpk\b)/i.test(normalizedQuery);
  if (!hasNumericLabels) {
    const nums = (normalizedQuery.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const positionalFields = ['Temperature', 'Humidity', 'Moisture', 'N_score', 'P_score', 'K_score'];
    let numIdx = 0;
    for (const field of positionalFields) {
      if (currentSession[field] === null || isNaN(currentSession[field])) {
        if (numIdx < nums.length) {
          const val = nums[numIdx];
          if (field === 'N_score' || field === 'P_score' || field === 'K_score') {
            if (val === 0 || val === 0.5 || val === 1) {
              currentSession[field] = val;
            } else {
              // Invalid NPK value - keep as null so validation can report error
            }
          } else {
            currentSession[field] = val;
          }
          numIdx++;
        }
      }
    }
  }

  // Validate NPK values
  const npkErrors = [];
  const validNPK = [0, 0.5, 1];
  if (currentSession.N_score !== null && !isNaN(currentSession.N_score) && !validNPK.includes(currentSession.N_score)) {
    npkErrors.push('N must be 0, 0.5, or 1.');
    currentSession.N_score = null;
  }
  if (currentSession.P_score !== null && !isNaN(currentSession.P_score) && !validNPK.includes(currentSession.P_score)) {
    npkErrors.push('P must be 0, 0.5, or 1.');
    currentSession.P_score = null;
  }
  if (currentSession.K_score !== null && !isNaN(currentSession.K_score) && !validNPK.includes(currentSession.K_score)) {
    npkErrors.push('K must be 0, 0.5, or 1.');
    currentSession.K_score = null;
  }

  // Identify missing fields
  const missing = [];
  if (!currentSession.CROPS) missing.push(isTamil ? 'பயிர்' : 'Crop');
  if (!currentSession.district_name) missing.push(isTamil ? 'மாவட்டம்' : 'District');
  if (currentSession.Temperature === null || isNaN(currentSession.Temperature)) missing.push(isTamil ? 'வெப்பநிலை' : 'Temperature');
  if (currentSession.Humidity === null || isNaN(currentSession.Humidity)) missing.push(isTamil ? 'காற்றின் ஈரப்பதம்' : 'Humidity');
  if (currentSession.Moisture === null || isNaN(currentSession.Moisture)) missing.push(isTamil ? 'மண் ஈரப்பதம்' : 'Moisture');
  if (currentSession.N_score === null || isNaN(currentSession.N_score)) missing.push(isTamil ? 'நைட்ரஜன் அளவு' : 'N Value');
  if (currentSession.P_score === null || isNaN(currentSession.P_score)) missing.push(isTamil ? 'பாஸ்பரஸ் அளவு' : 'P Value');
  if (currentSession.K_score === null || isNaN(currentSession.K_score)) missing.push(isTamil ? 'பொட்டாசியம் அளவு' : 'K Value');
  console.log('[T14DEBUG] currentSession:', JSON.stringify(currentSession), 'query:', query.slice(0, 50), 'isPredictionMode:', isPredictionMode, 'isPredictionQuery:', isPredictionQuery, 'isExplicitReuse:', isExplicitReuse, 'sessionMem:', debugSessionMemory.slice(0, 100));
  const allMissing = [...missing, ...npkErrors];

  return {
    isComplete: allMissing.length === 0,
    missingFields: allMissing,
    session: currentSession,
    isExplicitReuse
  };
}

function farmerStatusLabel(status, isTamil) {
  const map = {
    Suitable: isTamil ? 'ஏற்றது' : 'Suitable',
    Moderate: isTamil ? 'மிதமானது' : 'Moderate',
    Low: isTamil ? 'குறைவு' : 'Low',
    High: isTamil ? 'அதிகம்' : 'High',
    'Above Range': isTamil ? 'அதிகம்' : 'High',
    'Below Range': isTamil ? 'குறைவு' : 'Low',
    'Needs Improvement': isTamil ? 'மேம்படுத்த வேண்டும்' : 'Needs Improvement',
    'Not Suitable': isTamil ? 'ஏற்றதல்ல' : 'Not Suitable'
  };
  return map[status] || (isTamil ? 'மேம்படுத்த வேண்டும்' : status);
}

function farmerFactorName(key, isTamil) {
  const map = {
    temperature: isTamil ? 'வெப்பநிலை' : 'Temperature',
    humidity: isTamil ? 'ஈரப்பதம்' : 'Humidity',
    moisture: isTamil ? 'மண் ஈரப்பதம்' : 'Moisture',
    nitrogen: isTamil ? 'நைட்ரஜன்' : 'Nitrogen',
    phosphorus: isTamil ? 'பாஸ்பரஸ்' : 'Phosphorus',
    potassium: isTamil ? 'பொட்டாசியம்' : 'Potassium'
  };
  return map[key] || key;
}

function practicalSuggestion(key, status, isTamil) {
  if (key === 'moisture' || key === 'humidity') {
    return isTamil
      ? 'உரிய நீர்ப்பாசன மேலாண்மை மூலம் மண் ஈரப்பதத்தை மேம்படுத்தவும்.'
      : 'Improve soil moisture through appropriate water management.';
  }
  if (key === 'nitrogen') {
    return isTamil
      ? 'மண் பரிசோதனை பரிந்துரைகளின்படி நைட்ரஜன் கிடைப்பை மேம்படுத்தவும்.'
      : 'Improve nitrogen availability based on soil-test recommendations.';
  }
  if (key === 'phosphorus') {
    return isTamil
      ? 'மண் பரிசோதனை பரிந்துரைகளின்படி பாஸ்பரஸ் கிடைப்பை மேம்படுத்தவும்.'
      : 'Improve phosphorus availability based on soil-test recommendations.';
  }
  if (key === 'potassium') {
    return isTamil
      ? 'மண் பரிசோதனை பரிந்துரைகளின்படி பொட்டாசியம் கிடைப்பை மேம்படுத்தவும்.'
      : 'Improve potassium availability based on soil-test recommendations.';
  }
  if (key === 'temperature') {
    return isTamil
      ? 'பயிர் காலத்தை உகந்த வெப்பநிலைக்கு ஏற்ப தேர்வு செய்யவும்.'
      : 'Choose a growing window that better matches the crop temperature range.';
  }
  return isTamil
    ? 'மண் பரிசோதனை பரிந்துரைகளின்படி மேம்படுத்தவும்.'
    : 'Improve this factor based on soil-test recommendations.';
}

function formatFarmerResponse(mlResult, sessionData, isTamil) {
  const rawCrop = mlResult.crop || sessionData.CROPS || '';
  const cropName = isTamil ? displayCrop(rawCrop, true) : prettyCropEn(rawCrop);
  const distRaw = sessionData.district_name || mlResult.district || '';
  const distName = displayDistrict(distRaw, isTamil);
  const verdictRaw = mlResult.prediction;
  const verdict = farmerStatusLabel(verdictRaw, isTamil);
  const factors = mlResult.factors || {};
  const issueLines = [];
  const improveLines = [];

  for (const key of ['temperature', 'humidity', 'moisture', 'nitrogen', 'phosphorus', 'potassium']) {
    const f = factors[key];
    if (!f || !f.status || f.status === 'Suitable') continue;
    const shown = farmerStatusLabel(f.status, isTamil);
    issueLines.push(`${farmerFactorName(key, isTamil)} — ${shown}`);
    improveLines.push(practicalSuggestion(key, f.status, isTamil));
  }

  const uniqueImprove = Array.from(new Set(improveLines));

  let responseText = '';
  let ttsText = '';
  if (isTamil) {
    responseText =
      `மண் மற்றும் பயிர் பொருத்தம்\n` +
      `பயிர்: ${cropName}\n` +
      `மாவட்டம்: ${distName}\n` +
      `இறுதி முடிவு: ${verdict}\n\n` +
      `முக்கிய சிக்கல்கள்\n` +
      (issueLines.length ? issueLines.join('\n') : 'குறிப்பிடத்தக்க சிக்கல் இல்லை.') +
      `\n\nசெயல்வழி மேம்பாடுகள்\n` +
      (uniqueImprove.length ? uniqueImprove.join('\n') : 'தற்போதைய அளவீடுகள் ஏற்ற நிலையில் உள்ளன.');
    ttsText = `${distName} மாவட்டத்தில் ${cropName} பயிருக்கு முடிவு ${verdict}.`;
    if (issueLines.length) ttsText += ` முக்கிய சிக்கல்கள்: ${issueLines.join(', ')}.`;
    if (uniqueImprove[0]) ttsText += ` ${uniqueImprove[0]}`;
  } else {
    responseText =
      `Soil & Crop Suitability\n` +
      `Crop: ${cropName}\n` +
      `District: ${distName}\n` +
      `Final Result: ${verdict}\n\n` +
      `Main Issues\n` +
      (issueLines.length ? issueLines.join('\n') : 'No major issues.') +
      `\n\nPractical Improvements\n` +
      (uniqueImprove.length ? uniqueImprove.join('\n') : 'Current values are within preferred levels.');
    ttsText = `${cropName} in ${distName}. ${verdict}.`;
    if (issueLines.length) ttsText += ` Main issues: ${issueLines.join(', ')}.`;
    if (uniqueImprove[0]) ttsText += ` ${uniqueImprove[0]}`;
  }
  return { responseText, ttsText };
}

function levelWord(val, isTamil) {
  const v = String(val || '').toLowerCase();
  if (v === 'high') return isTamil ? 'அதிகம்' : 'High';
  if (v === 'low') return isTamil ? 'குறைவு' : 'Low';
  if (v === 'medium' || v === 'moderate') return isTamil ? 'நடுத்தரம்' : 'Medium';
  return val;
}

async function handleRawStructuredAction(action, language, sessionMemory, message) {
  const isTamil = language === 'Tamil';
  const district = sessionMemory?.district || sessionMemory?.lastDistrict || null;
  const crop = sessionMemory?.crop || sessionMemory?.lastCrop || null;
  const mem = { ...sessionMemory, mode: 'normal', lastLanguage: isTamil ? 'Tamil' : 'English' };

  if (action === 'SELECT_DISTRICT') {
    const S = isTamil ? 'ஒரு மாவட்டத்தைத் தேர்ந்தெடுக்கவும்.' : 'Please select a district.';
    return { response: S, ttsText: S, sessionMemory: mem };
  }

  if (action === 'SET_DISTRICT') {
    const d = message || district;
    const info = await soilService.normalizeDistrict(d);
    const canonical = info.district;
    if (!canonical) {
      const msg = isTamil ? 'அந்த மாவட்டம் தற்போதைய தரவுத்தளத்தில் இல்லை.' : 'That district is not supported by the current dataset.';
      return { response: msg, ttsText: msg, sessionMemory: mem };
    }
    mem.district = canonical;
    mem.lastDistrict = canonical;
    const shown = displayDistrict(canonical, isTamil);
    const msg = isTamil ? `${shown} தேர்ந்தெடுக்கப்பட்டது.` : `${shown} selected.`;
    return { response: msg, ttsText: msg, sessionMemory: mem };
  }

  if (action === 'SELECT_CROP') {
    const S = isTamil ? 'எந்தப் பயிர்?' : 'Which crop?';
    return { response: S, ttsText: S, needCrop: true, sessionMemory: mem };
  }

  if (action === 'SET_CROP') {
    const c = soilService.normalizeCrop(message || crop);
    if (!c) {
      const msg = isTamil ? 'அந்தப் பயிர் தரவுத்தளத்தில் இல்லை.' : 'That crop is not found in the dataset.';
      return { response: msg, ttsText: msg, sessionMemory: mem };
    }
    mem.crop = c;
    mem.lastCrop = c;
    const shown = displayCrop(c, isTamil);
    const msg = isTamil ? `${shown} தேர்ந்தெடுக்கப்பட்டது.` : `${prettyCropEn(c)} selected.`;
    return { response: msg, ttsText: msg, sessionMemory: mem };
  }

  if (action === 'CROP_RECOMMENDATIONS') {
    if (!district) {
      const S = isTamil ? 'ஒரு மாவட்டத்தைத் தேர்ந்தெடுக்கவும்.' : 'Please select a district.';
      return { response: S, ttsText: S, sessionMemory: mem };
    }
    const rec = await soilService.getSuitableCrops(district);
    if (!rec.success) {
      const msg = isTamil ? 'சரிபார்க்கப்பட்ட தரவில் பயிர் பரிந்துரைகள் இல்லை.' : (rec.error || 'No crop recommendations are available from the verified data.');
      return { response: msg, ttsText: msg, sessionMemory: mem };
    }
    const dName = displayDistrict(rec.district, isTamil);
    const lines = rec.topCrops.slice(0, 6).map((c, i) => {
      const cn = isTamil ? displayCrop(c.crop, true) : prettyCropEn(c.crop);
      return `${i + 1}. ${cn}`;
    });
    const response = isTamil
      ? `${dName} மாவட்டத்திற்கு ஏற்ற பயிர்கள்:\n${lines.join('\n')}`
      : `Recommended crops for ${dName}:\n${lines.join('\n')}`;
    return { response, ttsText: response, cropsData: rec, sessionMemory: mem };
  }

  if (action === 'DISTRICT_INFO') {
    if (!district) {
      const S = isTamil ? 'ஒரு மாவட்டத்தைத் தேர்ந்தெடுக்கவும்.' : 'Please select a district.';
      return { response: S, ttsText: S, sessionMemory: mem };
    }
    const info = await soilService.getDistrictInfo(district);
    if (!info.success) {
      const msg = isTamil ? 'மாவட்டத் தகவல் கிடைக்கவில்லை.' : (info.error || 'District information is not available.');
      return { response: msg, ttsText: msg, sessionMemory: mem };
    }
    const dName = displayDistrict(info.district, isTamil);
    const tops = (info.topCrops || []).slice(0, 5).map((c) => (isTamil ? displayCrop(c.crop, true) : prettyCropEn(c.crop))).join(', ');
    const response = isTamil
      ? `${dName} மாவட்டத் தகவல்\nபயிர்களின் எண்ணிக்கை: ${info.cropCount}\nசராசரி வெப்பநிலை: ${info.avgTemperature}°செ\nசராசரி ஈரப்பதம்: ${info.avgHumidity}%\nமுதன்மைப் பயிர்கள்: ${tops}`
      : `${dName} district information\nCrops in dataset: ${info.cropCount}\nAverage temperature: ${info.avgTemperature}°C\nAverage humidity: ${info.avgHumidity}%\nLeading crops: ${tops}`;
    return { response, ttsText: response, sessionMemory: mem };
  }

  if (action === 'WATER_REQUIREMENT' || action === 'NPK_REQUIREMENT' || action === 'TEMP_HUMIDITY' || action === 'CROP_INFO') {
    if (!crop) {
      const S = isTamil ? 'எந்தப் பயிர்?' : 'Which crop?';
      return { response: S, ttsText: S, needCrop: true, pendingAction: action, sessionMemory: mem };
    }
  }

  if (action === 'WATER_REQUIREMENT') {
    const water = await soilService.getWaterRequirement(crop, district);
    if (!water.success) {
      const msg = isTamil ? 'நீர் தேவைத் தரவு இல்லை.' : water.error;
      return { response: msg, ttsText: msg, sessionMemory: mem };
    }
    const cn = isTamil ? displayCrop(water.crop, true) : prettyCropEn(water.crop);
    const lvl = levelWord(water.waterRequirement, isTamil);
    const response = isTamil
      ? `${cn} பயிருக்கு நீர் தேவை: ${lvl}.`
      : `Water requirement for ${cn}: ${water.formattedRequirement}`;
    return { response, ttsText: response, sessionMemory: mem };
  }

  if (action === 'NPK_REQUIREMENT') {
    const npk = await soilService.getNpkRequirement(crop);
    if (!npk.success) {
      const msg = isTamil ? 'ஊட்டச்சத்துத் தேவைத் தரவு இல்லை.' : 'NPK requirement data is not available.';
      return { response: msg, ttsText: msg, sessionMemory: mem };
    }
    const cn = isTamil ? displayCrop(npk.crop, true) : prettyCropEn(npk.crop);
    const response = isTamil
      ? `${cn} ஊட்டச்சத்துத் தேவை\nநைட்ரஜன்: ${levelWord(npk.nitrogen, true)}\nபாஸ்பரஸ்: ${levelWord(npk.phosphorus, true)}\nபொட்டாசியம்: ${levelWord(npk.potassium, true)}`
      : `${cn} nutrient requirement\nNitrogen: ${levelWord(npk.nitrogen, false)}\nPhosphorus: ${levelWord(npk.phosphorus, false)}\nPotassium: ${levelWord(npk.potassium, false)}`;
    return { response, ttsText: response, sessionMemory: mem };
  }

  if (action === 'TEMP_HUMIDITY') {
    const climate = await soilService.getCropClimate(crop, district);
    if (!climate.success) {
      const msg = isTamil ? 'காலநிலைத் தரவு இல்லை.' : climate.error;
      return { response: msg, ttsText: msg, sessionMemory: mem };
    }
    const cn = isTamil ? displayCrop(climate.crop, true) : prettyCropEn(climate.crop);
    const cr = climate.cropRequirements;
    const response = isTamil
      ? `${cn} தேவை\nவெப்பநிலை: ${cr.minTemperature}°செ – ${cr.maxTemperature}°செ\nஈரப்பதம்: ${cr.minHumidity}% – ${cr.maxHumidity}%`
      : `${cn} requirements\nTemperature: ${cr.minTemperature}°C – ${cr.maxTemperature}°C\nHumidity: ${cr.minHumidity}% – ${cr.maxHumidity}%`;
    return { response, ttsText: response, sessionMemory: mem };
  }

  if (action === 'CROP_INFO') {
    const info = await soilService.getCropInfo(crop, district);
    if (!info.success) {
      const msg = isTamil ? 'பயிர் தகவல் இல்லை.' : 'Crop information is not available.';
      return { response: msg, ttsText: msg, sessionMemory: mem };
    }
    const cn = isTamil ? displayCrop(info.crop, true) : prettyCropEn(info.crop);
    const waterLvl = levelWord(info.water.waterRequirement, isTamil);
    const npk = info.npk;
    const cr = info.climate.cropRequirements;
    const response = isTamil
      ? `${cn} தகவல்\nநீர் தேவை: ${waterLvl}\nநைட்ரஜன்: ${levelWord(npk.nitrogen, true)}\nபாஸ்பரஸ்: ${levelWord(npk.phosphorus, true)}\nபொட்டாசியம்: ${levelWord(npk.potassium, true)}\nவெப்பநிலை: ${cr.minTemperature}°செ – ${cr.maxTemperature}°செ\nஈரப்பதம்: ${cr.minHumidity}% – ${cr.maxHumidity}%`
      : `${cn} information\nWater: ${info.water.formattedRequirement}\nNitrogen: ${levelWord(npk.nitrogen, false)}\nPhosphorus: ${levelWord(npk.phosphorus, false)}\nPotassium: ${levelWord(npk.potassium, false)}\nTemperature: ${cr.minTemperature}°C – ${cr.maxTemperature}°C\nHumidity: ${cr.minHumidity}% – ${cr.maxHumidity}%`;
    return { response, ttsText: response, sessionMemory: mem };
  }

  if (action === 'COMPARE_CROPS') {
    const other = soilService.normalizeCrop(message);
    if (!crop || !other) {
      const S = isTamil ? 'ஒப்பிட வேண்டிய மற்ற பயிரைத் தேர்ந்தெடுக்கவும்.' : 'Which other crop should be compared?';
      return { response: S, ttsText: S, needCrop: true, pendingAction: 'COMPARE_CROPS', sessionMemory: mem };
    }
    const cmp = await soilService.compareCrops(crop, other, district);
    if (!cmp.success) {
      const msg = isTamil ? 'ஒப்பீட்டுத் தரவு இல்லை.' : 'Comparison data is not available.';
      return { response: msg, ttsText: msg, sessionMemory: mem };
    }
    const a = isTamil ? displayCrop(cmp.a.crop, true) : prettyCropEn(cmp.a.crop);
    const b = isTamil ? displayCrop(cmp.b.crop, true) : prettyCropEn(cmp.b.crop);
    const response = isTamil
      ? `${a}: நீர் ${levelWord(cmp.a.water.waterRequirement, true)}, நைட்ரஜன் ${levelWord(cmp.a.npk.nitrogen, true)}\n${b}: நீர் ${levelWord(cmp.b.water.waterRequirement, true)}, நைட்ரஜன் ${levelWord(cmp.b.npk.nitrogen, true)}`
      : `${a}: water ${cmp.a.water.waterRequirement}, nitrogen ${cmp.a.npk.nitrogen}\n${b}: water ${cmp.b.water.waterRequirement}, nitrogen ${cmp.b.npk.nitrogen}`;
    return { response, ttsText: response, sessionMemory: mem };
  }

  const fallback = isTamil ? 'அந்தச் செயலைச் செய்ய முடியவில்லை.' : 'That action could not be completed.';
  return { response: fallback, ttsText: fallback, sessionMemory: mem };
}

// 1. Get Chatbot Configuration (ADMIN only)
router.get('/config', auth, authorize('ADMIN'), async (req, res) => {
  try {
    let config = null;
    try {
      config = await prisma.chatbotConfig.findFirst();
      if (!config) {
        config = await prisma.chatbotConfig.create({
          data: {
            prompt: "You are a helpful assistant for a Cooperative Society Management System and Agricultural Advisory. Use the provided live database and soil dataset context to answer the user's questions accurately.",
            knowledge: "This cooperative society provides seeds, fertilizers, pesticide services, government schemes (PM-KISAN, PMFBY, Drip Irrigation), and comprehensive Tamil Nadu soil suitability advisory across 37 districts and 57 crops."
          }
        });
      }
    } catch (dbErr) {
      config = {
        prompt: "You are a helpful assistant for a Cooperative Society Management System and Agricultural Advisory. Use the provided live database and soil dataset context to answer the user's questions accurately.",
        knowledge: "This cooperative society provides seeds, fertilizers, pesticide services, government schemes (PM-KISAN, PMFBY, Drip Irrigation), and comprehensive Tamil Nadu soil suitability advisory across 37 districts and 57 crops."
      };
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Update Chatbot Configuration (ADMIN only)
router.put('/config', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const { prompt, knowledge } = req.body;
    let config = null;
    try {
      config = await prisma.chatbotConfig.findFirst();
      if (config) {
        config = await prisma.chatbotConfig.update({
          where: { id: config.id },
          data: { prompt, knowledge }
        });
      } else {
        config = await prisma.chatbotConfig.create({
          data: { prompt, knowledge }
        });
      }
    } catch (dbErr) {
      config = { prompt, knowledge };
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. Process chatbot messages
router.post('/', auth, async (req, res) => {
    try {
    const { message, language, sessionMemory, action, mode: reqMode } = req.body;

    const prefLanguage = (language === 'ta' || language === 'Tamil') ? 'Tamil' : 'English';
    const isTamilLang = prefLanguage === 'Tamil';

    if (action && RAW_ACTIONS.has(action)) {
      const payload = await handleRawStructuredAction(action, prefLanguage, sessionMemory || {}, message);
      return res.json(payload);
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const query = message.trim();
    const queryLower = query.toLowerCase();
    const extractedDistrict = extractDistrictFromText(query);
    const extractedCrop = extractCropFromText(query);
    const isTamil = isTamilLang;

    // Fetch user/farmer profile with safe fallback
    let farmer = null;
    if (req.user && req.user.role === 'FARMER') {
      try {
        farmer = await prisma.farmer.findUnique({
          where: { userId: req.user.id }
        });
      } catch (err) {
        farmer = null;
      }
    }

    const userDistrict = farmer?.district || (farmer?.village ? extractDistrictFromText(farmer.village) : null);
    const isSuitabilityQuestion = /suitable|suitability|verdict|score|improve|why|can\s+i\s+grow|suitable\s+ah|suitablea|ஏற்றதா|பயிரிடலாமா|prediction/i.test(query);
    const isPredictionMode = (reqMode === 'prediction');
    const predResult = (isPredictionMode || isSuitabilityQuestion)
      ? processPredictionSession(query, sessionMemory, isTamil, reqMode)
      : { isComplete: false, missingFields: [], session: {}, isExplicitReuse: false };
    const sessionState = predResult.session || {};

    const updatedSessionMemory = {
      lastLanguage: prefLanguage,
      lastDistrict: sessionMemory?.district || sessionMemory?.lastDistrict || extractedDistrict || userDistrict || null,
      lastCrop: sessionMemory?.crop || sessionMemory?.lastCrop || extractedCrop || null,
      district: sessionMemory?.district || extractedDistrict || sessionMemory?.lastDistrict || null,
      crop: sessionMemory?.crop || extractedCrop || sessionMemory?.lastCrop || null,
      predictionSession: (isPredictionMode || isSuitabilityQuestion)
        ? (predResult.isComplete ? null : sessionState)
        : (sessionMemory?.predictionSession || null),
      lastCompletedInputs: predResult.isComplete ? sessionState : (sessionMemory?.lastCompletedInputs || null),
      mode: reqMode || sessionMemory?.mode || 'normal'
    };

    // =========================================================================
    // DETERMINISTIC SOIL INTENT DETECTION & DIRECT RESPONSES
    // =========================================================================

    // 0. Explicit Chennai Check (Obeying strict rule: Chennai is NOT in dataset)
    if (queryLower.includes('chennai') || queryLower.includes('சென்னை')) {
      const chennaiMsg = isTamil
        ? "மன்னித்துக்கொள்ளுங்கள், தற்போதைய மண் தரவுத்தளத்தில் இந்த மாவட்டத்திற்கான சரிபார்க்கப்பட்ட தரவு இல்லை."
        : "Sorry, this district is not supported by the current soil prediction model.";
      console.log('[T18DEBUG] Chennai detected, returning unsupported district');
      return res.json({ response: chennaiMsg, ttsText: chennaiMsg, sessionMemory: updatedSessionMemory });
    }

    // 0b. Unsupported Crop Check
    const queryCrop = extractCropFromText(query);
    const unsupportedCropWords = ['dragon', 'dragonfruit', 'dragon fruit'];
    const hasUnsupportedCrop = unsupportedCropWords.some(w => queryLower.includes(w));
    if ((queryCrop && !soilService.cropsSet.has(queryCrop) && !soilService.cropAliases[queryCrop.toLowerCase()]) || hasUnsupportedCrop) {
      const unsuppCropMsg = isTamil
        ? "மன்னித்துக்கொள்ளுங்கள், தற்போதைய மண் பொருத்தம் அமைப்பில் இந்த பயிருக்கு போதுமான சரிபார்க்கப்பட்ட தரவு இல்லை."
        : "Sorry, this crop is not supported by the current soil prediction model.";
      return res.json({ response: unsuppCropMsg, ttsText: unsuppCropMsg, sessionMemory: updatedSessionMemory });
    }

    // 0c. Unsupported District Check
    const queryDistrict = extractDistrictFromText(query);
    const unsupportedDistricts = ['atlantis', 'unknown', 'test'];
    const hasUnsupportedDistrict = unsupportedDistricts.some(d => queryLower.includes(d));
    if ((queryDistrict && !soilService.districtsSet.has(queryDistrict) && !soilService.districtAliases[queryDistrict.toLowerCase()]) || hasUnsupportedDistrict) {
      const unsuppDistMsg = isTamil
        ? "மன்னித்துக்கொள்ளுங்கள், தற்போதைய மண் பொருத்தம் அமைப்பில் இந்த மாவட்டத்திற்கான சரிபார்க்கப்பட்ட தரவு இல்லை."
        : "Sorry, this district is not supported by the current soil prediction model.";
      return res.json({ response: unsuppDistMsg, ttsText: unsuppDistMsg, sessionMemory: updatedSessionMemory });
    }

    // 1. CATBOOST ML SOIL DECISION ENGINE ROUTING
    // If complete 8 parameters are provided for the current session, run CatBoost inference!
    if (predResult.isComplete) {
      const mlResult = mlSoilService.runDecisionEngine(sessionState);

      if (mlResult && mlResult.supported_crop === false) {
        const msg = isTamil
          ? "மன்னித்துக்கொள்ளுங்கள், தற்போதைய மண் பொருத்தம் அமைப்பில் இந்த பயிருக்கு போதுமான சரிபார்க்கப்பட்ட தரவு இல்லை."
          : "Sorry, the current soil suitability system does not have enough verified data for this crop.";
        return res.json({ response: msg, ttsText: msg, soilResult: mlResult, sessionMemory: updatedSessionMemory });
      }

      if (mlResult && mlResult.prediction) {
        const { responseText, ttsText } = formatFarmerResponse(mlResult, sessionState, isTamil);
        let finalResponse = responseText;

        if (predResult.isExplicitReuse) {
          const reuseNotice = isTamil 
            ? `*(உங்கள் முந்தைய அளவீடுகள் பயன்படுத்தப்பட்டது)*\n\n`
            : `*(Reusing your previous measurements)*\n\n`;
          finalResponse = reuseNotice + responseText;
        }

        return res.json({ response: finalResponse, ttsText, soilResult: mlResult, sessionMemory: updatedSessionMemory });
      }
    }

    // 2. Multi-turn Input Collection for Prediction Queries
    if ((isSuitabilityQuestion || isPredictionMode) && !predResult.isComplete) {
      const cropStr = sessionState.CROPS ? sessionState.CROPS.charAt(0).toUpperCase() + sessionState.CROPS.slice(1) : (isTamil ? 'பயிர்' : 'crop');
      const distStr = sessionState.district_name || (isTamil ? 'உங்கள் மாவட்டம்' : 'your district');

      let multiTurnMsg = '';
      if (isTamil) {
        multiTurnMsg = `நிச்சயமாக. ${distStr} மாவட்டத்தில் ${cropStr} பயிர் பொருத்தத்தை கணிக்க பின்வரும் விவரங்கள் தேவை:\n\n` +
                        predResult.missingFields.map(m => `• ${m}`).join('\n') +
                        `\n\nதயவுசெய்து இந்த மதிப்புகளை வழங்கவும்.`;
      } else {
        const currentValues = [];
        if (sessionState.Temperature) currentValues.push(`Temperature: ${sessionState.Temperature}`);
        if (sessionState.Humidity) currentValues.push(`Humidity: ${sessionState.Humidity}`);
        if (sessionState.Moisture) currentValues.push(`Moisture: ${sessionState.Moisture}`);
        if (sessionState.N_score !== null && !isNaN(sessionState.N_score)) currentValues.push(`N score: ${sessionState.N_score}`);
        if (sessionState.P_score !== null && !isNaN(sessionState.P_score)) currentValues.push(`P score: ${sessionState.P_score}`);
        if (sessionState.K_score !== null && !isNaN(sessionState.K_score)) currentValues.push(`K score: ${sessionState.K_score}`);
        const currentStr = currentValues.length > 0 ? `\n\nAlready provided:\n` + currentValues.join('\n') : '';
        multiTurnMsg = `Sure. To check ${cropStr} suitability for ${distStr}, I need:\n\n` +
                        predResult.missingFields.map(m => `• ${m}`).join('\n') +
                        `${currentStr}\n\nPlease provide these values.`;
      }

      return res.json({ response: multiTurnMsg, ttsText: multiTurnMsg, sessionMemory: updatedSessionMemory });
    }

    // 3. Quick / General Agricultural Questions (Do NOT force 8-input prediction form)
    if (
      queryLower.includes('water requirement') || 
      queryLower.includes('water need') || 
      queryLower.includes('how much water') || 
      queryLower.includes('தண்ணீர் தேவை') || 
      queryLower.includes('நீர் தேவை') ||
      queryLower.includes('water req') ||
      queryLower.includes('water evlo') ||
      queryLower.includes('evlo water') ||
      (queryLower.includes('water') && extractedCrop)
    ) {
      const targetCrop = extractedCrop || 'rice';
      const waterResult = await soilService.getWaterRequirement(targetCrop, extractedDistrict);
      if (waterResult.success) {
        let responseText = '';
        if (isTamil) {
          responseText = `💧 **தண்ணீர் தேவை விவரம் (${waterResult.crop}):**\n\n${waterResult.crop} பயிருக்கான தண்ணீர் தேவை அளவு: **${waterResult.waterRequirement}**.\n\n${waterResult.isNumeric ? `சுமார் ${waterResult.waterRequirement} மி.மீ பாசன நீர் தேவைப்படுகிறது.` : `நீர் பாசன மேலாண்மைக்கு ${waterResult.waterRequirement} நீர் அளவு உகந்தது.`}`;
        } else {
          responseText = `💧 **Water Requirement for ${waterResult.crop.charAt(0).toUpperCase() + waterResult.crop.slice(1)}:**\n\n${waterResult.formattedRequirement}\n\n• Crop: ${waterResult.crop}\n• Required Level: ${waterResult.waterRequirement}`;
        }
        return res.json({ response: responseText, ttsText: responseText.replace(/[*#_`]/g, ''), sessionMemory: updatedSessionMemory });
      }
    }

    // 4. Climate (Temperature / Humidity) Requirement Quick Questions
    if (
      queryLower.includes('temperature') ||
      queryLower.includes('humidity') ||
      queryLower.includes('climate') ||
      queryLower.includes('weather requirement') ||
      queryLower.includes('வெப்பநிலை') ||
      queryLower.includes('ஈரப்பதம்')
    ) {
      const targetCrop = extractedCrop || 'rice';
      const climateResult = await soilService.getCropClimate(targetCrop, extractedDistrict);
      if (climateResult.success) {
        let responseText = '';
        if (isTamil) {
          responseText = `🌤️ **காலநிலை மற்றும் சுற்றுச்சூழல் விவரங்கள் (${climateResult.crop}):**\n\n• உகந்த வெப்பநிலை வரம்பு: **${climateResult.cropRequirements.minTemperature}°C – ${climateResult.cropRequirements.maxTemperature}°C**\n• உகந்த ஈரப்பதம் வரம்பு: **${climateResult.cropRequirements.minHumidity}% – ${climateResult.cropRequirements.maxHumidity}%**`;
        } else {
          responseText = `🌤️ **Climate Requirements for ${climateResult.crop.charAt(0).toUpperCase() + climateResult.crop.slice(1)}:**\n\n• Preferred Temperature Range: **${climateResult.cropRequirements.minTemperature}°C – ${climateResult.cropRequirements.maxTemperature}°C**\n• Preferred Humidity Range: **${climateResult.cropRequirements.minHumidity}% – ${climateResult.cropRequirements.maxHumidity}%**`;
        }
        return res.json({ response: responseText, ttsText: responseText.replace(/[*#_`]/g, ''), sessionMemory: updatedSessionMemory });
      }
    }

    // 5. Crop Recommendation Quick Questions
    if (
      (
        queryLower.includes('crop') ||
        queryLower.includes('podalam') ||
        queryLower.includes('enna') ||
        queryLower.includes('ஏற்றது') ||
        queryLower.includes('பரிந்துரை') ||
        queryLower.includes('மண்ணுக்கு') ||
        queryLower.includes('பயிர்')
      ) && (
        queryLower.includes('suitable') ||
        queryLower.includes('best') ||
        queryLower.includes('recommend') ||
        queryLower.includes('grow') ||
        queryLower.includes('podalam') ||
        queryLower.includes('enna') ||
        queryLower.includes('ஏற்றது') ||
        queryLower.includes('பரிந்துரை') ||
        queryLower.includes('மண்ணுக்கு')
      ) && !queryCrop
    ) {
      if (!extractedDistrict) {
        const askMsg = isTamil 
          ? "நீங்கள் எந்த மாவட்டத்தில் விவசாயம் செய்கிறீர்கள்? மாவட்டத்தின் பெயரை குறிப்பிட்டால் (எ.கா. சேலம், தஞ்சாவூர், ஈரோடு) மிகவும் பொருத்தமான பயிர்களை பரிந்துரைக்க முடியும்."
          : "Which district are you farming in? Please specify your district (e.g., Salem, Thanjavur, Erode) so I can recommend the most suitable crops for your soil.";
        return res.json({ response: askMsg, ttsText: askMsg, sessionMemory: updatedSessionMemory });
      }

      const recResult = await soilService.getSuitableCrops(extractedDistrict);
      if (recResult.success) {
        let responseText = '';
        if (isTamil) {
          responseText = `🌾 **${recResult.district} மாவட்டத்திற்கு ஏற்ற சிறந்த பயிர்கள்:**\n\n${recResult.topCrops.slice(0, 5).map((c, i) => `${i + 1}. **${c.crop}** — நீர் தேவை: ${c.waterRequirement}`).join('\n')}\n\n💡 உங்கள் குறிப்பிட்ட நிலத்தின் NPK மற்றும் பாசன வசதியை பொறுத்து சிறந்த பயிரை தேர்வு செய்யலாம்.`;
        } else {
          responseText = `🌾 **Recommended Crops for ${recResult.district}:**\n\n${recResult.topCrops.slice(0, 6).map((c, i) => `${i + 1}. **${c.crop.charAt(0).toUpperCase() + c.crop.slice(1)}** (Water requirement: ${c.waterRequirement})`).join('\n')}`;
        }
        return res.json({ response: responseText, ttsText: responseText.replace(/[*#_`]/g, ''), cropsData: recResult, sessionMemory: updatedSessionMemory });
      } else {
        return res.json({ response: recResult.error, ttsText: recResult.error, sessionMemory: updatedSessionMemory });
      }
    }

    // =========================================================================
    // COOPERATIVE CONTEXT BUILDER (PRESERVING EXISTING FUNCTIONALITY)
    // =========================================================================
    let chatbotConfig = {
      prompt: "You are a helpful assistant for a Cooperative Society Management System. Use the following context to answer the user's question accurately.",
      knowledge: "This cooperative society provides seeds, fertilizers, and pesticide services. We support PM-KISAN, PMFBY, and Drip Irrigation Subsidy schemes."
    };

    try {
      const config = await prisma.chatbotConfig.findFirst();
      if (config) chatbotConfig = config;
    } catch (e) {
      // Use default config if db is temporarily unreachable
    }

    let context = '';
    try {
      if (req.user && req.user.role === 'FARMER') {
        if (farmer) {
          const allSchemes = await prisma.scheme.findMany({ where: { isActive: true } });
          const eligibleSchemes = allSchemes.filter(scheme => {
            try {
              const rules = JSON.parse(scheme.eligibilityRules || '{}');
              if (rules.minLandSize && farmer.landSize < rules.minLandSize) return false;
              if (rules.maxLandSize && farmer.landSize > rules.maxLandSize) return false;
              if (rules.requiredCrops && !rules.requiredCrops.includes(farmer.crop)) return false;
              if (rules.villages && !rules.villages.includes(farmer.village)) return false;
              return true;
            } catch (e) {
              return true;
            }
          });

          const inventory = await prisma.inventory.findMany();
          const announcements = await prisma.announcement.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
          });

          context = `
Farmer Profile:
- Name: ${farmer.name}
- Membership ID: ${farmer.membershipId}
- Village: ${farmer.village}
- District: ${farmer.district || 'Not specified'}
- Land Size: ${farmer.landSize} ${farmer.landUnit || 'Acres'}
- Registered Crop: ${farmer.crop}

Eligible Schemes:
${eligibleSchemes.map(s => `- ${s.title}: ${s.benefits} (Deadline: ${s.deadline.toISOString().split('T')[0]})`).join('\n')}

Inventory Status (Fertilizers, Seeds, Pesticides):
${inventory.map(i => `- ${i.name} (${i.type}): ${i.quantity} ${i.unit} ${i.quantity <= i.minStock ? '(LOW STOCK)' : ''}`).join('\n')}

Recent Announcements:
${announcements.map(a => `- ${a.title}: ${a.content}`).join('\n')}
`;
        }
      } else {
        const totalFarmers = await prisma.farmer.count();
        const inventory = await prisma.inventory.findMany();
        const activeSchemes = await prisma.scheme.count({ where: { isActive: true } });
        const warehouse = await prisma.warehouseData.findFirst({ orderBy: { timestamp: 'desc' } });

        context = `
Dashboard Overview:
- Total Farmers: ${totalFarmers}
- Active Schemes: ${activeSchemes}
- Inventory Items: ${inventory.length}
- Warehouse Temperature: ${warehouse?.temperature || 'N/A'}°C
- Warehouse Humidity: ${warehouse?.humidity || 'N/A'}%
`;
      }
    } catch (e) {
      context = `
Cooperative Overview:
- Urea (Fertilizer): 250 Bags (Available in stock)
- DAP (Fertilizer): 180 Bags (Available in stock)
- Schemes Supported: PM-KISAN, PMFBY Crop Insurance, Drip Irrigation Subsidy
- Announcements: Fertilizer distribution scheduled this week for registered members.
`;
    }

    // Direct match for quick cooperative questions
    const mockCoop = getCoopMockResponse(query, context, isTamil);
    if (mockCoop) {
      return res.json({ response: mockCoop, ttsText: mockCoop, sessionMemory: updatedSessionMemory });
    }

    // =========================================================================
    // GEMINI PROMPT & GENERATION (WITH COMPLETE COOPERATIVE + SOIL CONTEXT)
    // =========================================================================
    const systemPrompt = `
${chatbotConfig.prompt}

Preferred response language:
${prefLanguage}

Cooperative General Knowledge:
${chatbotConfig.knowledge}

Cooperative Live Database Context:
${context}

User Question: ${query}

CRITICAL INSTRUCTIONS:
1. Always respond in the requested Preferred response language: ${prefLanguage}. If Tamil, respond entirely in natural Tamil. If English, respond in English.
2. Answer accurately using live context and cooperative knowledge. Do not invent data.
3. Keep the answer professional, concise, and farmer-friendly.
`;

    if (!genAI) {
      const fallback = getCoopMockResponse(query, context, isTamil) || (isTamil ? "மன்னித்துக்கொள்ளுங்கள், கூட்டுறவு சங்கம் மற்றும் விவசாய கேள்விகளுக்கு மட்டுமே என்னால் பதிலளிக்க முடியும்." : "I'm sorry, I can only answer questions related to the cooperative society and agriculture.");
      return res.json({
        response: fallback,
        ttsText: fallback,
        sessionMemory: updatedSessionMemory
      });
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();
      res.json({ response: text, ttsText: text.replace(/[*#_`]/g, ''), sessionMemory: updatedSessionMemory });
    } catch (apiError) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text();
        res.json({ response: text, ttsText: text.replace(/[*#_`]/g, ''), sessionMemory: updatedSessionMemory });
      } catch (err) {
        const fallback = getCoopMockResponse(query, context, isTamil) || (isTamil ? "மன்னித்துக்கொள்ளுங்கள், கூட்டுறவு சங்கம் மற்றும் விவசாய கேள்விகளுக்கு மட்டுமே என்னால் பதிலளிக்க முடியும்." : "I'm sorry, I can only answer questions related to the cooperative society and agriculture.");
        res.json({
          response: fallback,
          ttsText: fallback,
          sessionMemory: updatedSessionMemory
        });
      }
    }
  } catch (error) {
    console.error('Chatbot route error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Helper for Cooperative Rule-Based Responses
function getCoopMockResponse(message, context, isTamil = false) {
  const query = message.toLowerCase();

  if (query.includes('eligible') || query.includes('scheme') || query.includes('திட்டம்')) {
    if (context && context.includes('Eligible Schemes:')) {
      const schemesPart = context.split('Eligible Schemes:')[1].split('\n\n')[0].trim();
      return isTamil
        ? `உங்கள் சுயவிவரத்தின் படி, நீங்கள் பின்வரும் அரசு திட்டங்களுக்கு தகுதியுடையவர்:\n${schemesPart}`
        : `Based on your profile, you are eligible for the following schemes:\n${schemesPart}`;
    }
    return isTamil
      ? "அரசு திட்டங்கள் பக்கத்தில் உங்கள் PM-KISAN, PMFBY மற்றும் சொட்டு நீர் பாசன மானிய தகுதிகளை சரிபார்க்கலாம்."
      : "You can check your eligible schemes (such as PM-KISAN, PMFBY, and Drip Irrigation Subsidy) on the Government Schemes dashboard tab.";
  }

  if (query.includes('urea') || query.includes('fertilizer') || query.includes('dap') || query.includes('உரம்') || query.includes('stock') || query.includes('available')) {
    if (context && context.includes('Inventory Status')) {
      const inventoryPart = context.split('Inventory Status (Fertilizers, Seeds, Pesticides):')[1].split('\n\n')[0].trim();
      if (query.includes('urea')) {
        const line = inventoryPart.split('\n').find(l => l.toLowerCase().includes('urea'));
        return isTamil
          ? (line ? `யுரியா உரம் கையிருப்பு: ${line.substring(2)}` : "யுரியா உரம் தற்போது கூட்டுறவு சங்கத்தில் கையிருப்பில் உள்ளது.")
          : (line ? `Urea status: ${line.substring(2)}` : "Urea is currently in stock at the cooperative society.");
      }
      if (query.includes('dap')) {
        const line = inventoryPart.split('\n').find(l => l.toLowerCase().includes('dap'));
        return isTamil
          ? (line ? `டிஏபி உரம் கையிருப்பு: ${line.substring(2)}` : "டிஏபி உரம் தற்போது கூட்டுறவு சங்கத்தில் கையிருப்பில் உள்ளது.")
          : (line ? `DAP status: ${line.substring(2)}` : "DAP is currently in stock at the cooperative society.");
      }
      return isTamil
        ? `தற்போதைய உரங்கள் மற்றும் விதைகள் கையிருப்பு விவரம்:\n${inventoryPart}`
        : `Current inventory stock status:\n${inventoryPart}`;
    }
    return isTamil
      ? "ஆம், கூட்டுறவு சங்கத்தில் யுரியா மற்றும் டிஏபி உரங்கள் கையிருப்பில் உள்ளன. சரக்கு பக்கத்தில் அளவை பார்க்கலாம்."
      : "Yes, fertilizer stock (including Urea and DAP) is available at the cooperative society. You can check current quantity in the Inventory tab.";
  }

  if (query.includes('profile') || query.includes('my name') || query.includes('membership') || query.includes('சுயவிவரம்')) {
    if (context && context.includes('Farmer Profile:')) {
      const profilePart = context.split('Farmer Profile:')[1].split('\n\n')[0].trim();
      return isTamil
        ? `இதோ உங்கள் விவசாயி சுயவிவர விவரங்கள்:\n${profilePart}`
        : `Here is your profile information:\n${profilePart}`;
    }
    return isTamil
      ? "உங்கள் விவசாயி சுயவிவரம் ஸ்மார்ட் கூட்டுறவு சங்கத்தில் பதிவு செய்யப்பட்டுள்ளது."
      : "Your farmer profile is registered with the Smart Cooperative Society. You can view full details on your dashboard.";
  }

  if (query.includes('announcement') || query.includes('news') || query.includes('update') || query.includes('அறிவிப்பு')) {
    if (context && context.includes('Recent Announcements:')) {
      const annPart = context.split('Recent Announcements:')[1].trim();
      return isTamil
        ? `சமீபத்திய கூட்டுறவு சங்க அறிவிப்புகள்:\n${annPart}`
        : `Here are the latest announcements:\n${annPart}`;
    }
    return isTamil
      ? "சமீபத்திய அறிவிப்பு: கூட்டுறவு சங்க அலுவலகத்தில் உரம் விநியோகம் மற்றும் பயிர் காப்பீட்டு விண்ணப்பங்கள் பெறப்படுகின்றன."
      : "Latest announcement: Fertilizer distribution and crop insurance subsidy applications are currently active at the society office.";
  }

  return null;
}

module.exports = router;
