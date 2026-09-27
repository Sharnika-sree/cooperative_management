// =========================================================================
// Shared pure logic for the Soil Prediction guided form AND raw-data
// agricultural chatbot flow.
// DEPENDENCY-FREE (no imports) so it can be unit-tested in plain Node and
// reused by every chatbot UI (floating widget, settings page, future pages).
// One change here automatically affects every chatbot in the website.
// =========================================================================

export const PREDICTION_FIELDS = [
  { key: 'district', type: 'select' },
  { key: 'crop', type: 'select' },
  { key: 'temperature', type: 'number' },
  { key: 'humidity', type: 'number' },
  { key: 'moisture', type: 'number' },
  { key: 'n', type: 'number' },
  { key: 'p', type: 'number' },
  { key: 'k', type: 'number' }
];

export const NUMERIC_FIELD_KEYS = ['temperature', 'humidity', 'moisture', 'n', 'p', 'k'];

export const POSITIONAL_ORDER = ['temperature', 'humidity', 'moisture', 'n', 'p', 'k'];
export const VALID_NPK = [0, 0.5, 1];

// ============================================================================
// TAMIL LOCALIZATION MAPPING
// Display Tamil names in the UI, map back to canonical English values.
// ============================================================================
export const TAMIL_DISTRICTS = {
  'சேலம்': 'Salem', 'தஞ்சாவூர்': 'Thanjavur', 'தஞ்சை': 'Thanjavur',
  'ஈரோடு': 'Erode', 'கோயம்புத்தூர்': 'Coimbatore', 'கோவை': 'Coimbatore',
  'மதுரை': 'Madurai', 'திருச்சிராப்பள்ளி': 'Tiruchirappalli',
  'திருச்சி': 'Tiruchirappalli', 'திண்டுக்கல்': 'Dindigul',
  'தர்மபுரி': 'Dharmapuri', 'கிருஷ்ணகிரி': 'Krishnagiri',
  'திருநெல்வேலி': 'Tirunelveli', 'நெல்லை': 'Tirunelveli',
  'தூத்துக்குடி': 'Thoothukkudi', 'துத்திக்கோடி': 'Thoothukkudi',
  'கடலூர்': 'Cuddalore', 'விழுப்புரம்': 'Viluppuram',
  'வில்லுபுரம்': 'Viluppuram', 'வேலூர்': 'Vellore',
  'காஞ்சிபுரம்': 'Kancheepuram', 'செங்கல்பட்டு': 'Chengalpattu',
  'திருவள்ளூர்': 'Thiruvallur', 'திருப்பூர்': 'Tiruppur',
  'நாமக்கல்': 'Namakkal', 'கரூர்': 'Karur',
  'பெரம்பலூர்': 'Perambalur', 'அரியலூர்': 'Ariyalur',
  'நாகப்பட்டினம்': 'Nagapattinam', 'திருவாரூர்': 'Thiruvarur',
  'மயிலாடுதுறை': 'Mayiladuthurai', 'புதுக்கோட்டை': 'Pudukkottai',
  'சிவகங்கை': 'Sivaganga', 'ராமநாதபுரம்': 'Ramanathapuram',
  'விருதுநகர்': 'Virudhunagar', 'தென்காசி': 'Tenkasi',
  'கன்னியாகுமரி': 'Kanniyakumari', 'தேனி': 'Theni',
  'நீலகிரி': 'The Nilgiris', 'ஓட்டி': 'The Nilgiris',
  'திருப்பத்தூர்': 'Tirupathur', 'ராணிப்பேட்டை': 'Ranipet',
  'கள்ளக்குறிச்சி': 'Kallakurichi', 'திருவண்ணாமலை': 'Tiruvannamalai'
};

export const TAMIL_CROPS = {
  'நெல்': 'rice', 'நிலக்கடலை': 'groundnut', 'வேர்க்கடலை': 'groundnut',
  'மக்காச்சோளம்': 'maize', 'சோளம்': 'sorghum',
  'கம்பு': 'Pearl millet', 'பாஜ்ரா': 'Pearl millet',
  'கேழ்வரகு': 'ragi', 'கொள்ளு': 'horsegram',
  'உளுந்து': 'blackgram', 'பாசிப்பயறு': 'greengram',
  'கரும்பு': 'sugarcane', 'பருத்தி': 'cotton',
  'வெங்காயம்': 'onion', 'சின்ன வெங்காயம்': 'small onion',
  'கத்தரிக்காய்': 'brinjal', 'வெண்டைக்காய்': 'bhendi',
  'மிளகாய்': 'chillies', 'மரவள்ளிக்கிழங்கு': 'tapoica',
  'மஞ்சள்': 'turmeric', 'கோதுமை': 'wheat',
  'முட்டைக்கோஸ்': 'Cabbage', 'காலிஃபிளவர்': 'cauliflower',
  'சேனைக்கிழங்கு': 'elephant foot yam', 'எள்': 'gingely',
  'சோயா': 'soyabean', 'சூரியகாந்தி': 'sunflower',
  'சர்க்கரைவள்ளிக்கிழங்கு': 'sweet potato', 'தர்பூசணி': 'watermelon'
};

const EN_TO_TAMIL_DISTRICT = {};
for (const [tamil, english] of Object.entries(TAMIL_DISTRICTS)) {
  if (!EN_TO_TAMIL_DISTRICT[english]) EN_TO_TAMIL_DISTRICT[english] = tamil;
}
const EN_TO_TAMIL_CROP = {};
for (const [tamil, english] of Object.entries(TAMIL_CROPS)) {
  if (!EN_TO_TAMIL_CROP[english]) EN_TO_TAMIL_CROP[english] = tamil;
}

export const RAW_ACTIONS = new Set([
  'SELECT_DISTRICT', 'SET_DISTRICT', 'SELECT_CROP', 'SET_CROP',
  'CROP_RECOMMENDATIONS', 'DISTRICT_INFO', 'CROP_INFO', 'CROP_REQUIREMENTS',
  'WATER_REQUIREMENT', 'NPK_REQUIREMENT', 'TEMP_HUMIDITY',
  'TEMPERATURE_REQUIREMENT', 'HUMIDITY_REQUIREMENT', 'COMPARE_CROPS'
]);

export function displayDistrictName(english, language) {
  if (!english) return '';
  return resolveFormLang(language) === 'Tamil' ? (EN_TO_TAMIL_DISTRICT[english] || english) : english;
}
export function displayCropName(english, language) {
  if (!english) return '';
  if (resolveFormLang(language) === 'Tamil') return EN_TO_TAMIL_CROP[english] || english;
  return String(english).charAt(0).toUpperCase() + String(english).slice(1);
}

export function toCanonicalDistrict(displayName) {
  if (!displayName) return displayName;
  return TAMIL_DISTRICTS[String(displayName).trim()] || String(displayName).trim();
}
export function toCanonicalCrop(displayName) {
  if (!displayName) return displayName;
  return TAMIL_CROPS[String(displayName).trim()] || String(displayName).trim();
}

export function getDistrictOptions(language) {
  const lang = resolveFormLang(language);
  const unique = [...new Set(Object.values(TAMIL_DISTRICTS))].sort();
  return unique.map((d) => ({
    display: lang === 'Tamil' ? (EN_TO_TAMIL_DISTRICT[d] || d) : d,
    value: d
  }));
}
export function getCropOptions(language) {
  const lang = resolveFormLang(language);
  const unique = [...new Set(Object.values(TAMIL_CROPS))].sort((a, b) => String(a).localeCompare(String(b)));
  return unique.map((c) => ({
    display: lang === 'Tamil' ? (EN_TO_TAMIL_CROP[c] || c) : (String(c).charAt(0).toUpperCase() + String(c).slice(1)),
    value: c
  }));
}

export function canonicalizeForm(fields) {
  return { ...fields, district: toCanonicalDistrict(fields.district), crop: toCanonicalCrop(fields.crop) };
}

export function emptyPredictionForm() {
  return { district: '', crop: '', temperature: '', humidity: '', moisture: '', n: '', p: '', k: '' };
}

// ============================================================================
// RAW-DATA CHATBOT UI STRINGS
// Every user-facing element for the raw-data flow (NOT ML prediction).
// Tanglish resolves to Tamil.
// ============================================================================
export const RAW_DATA_STRINGS = {
  English: {
    greeting: 'Hello. I am your agricultural assistant. I share verified crop and district information from our dataset.',
    districtBtn: 'District',
    askDistrict: 'Please select a district.',
    selectDistrict: 'Select a district.',
    cropRecommendations: 'Crop Recommendations',
    districtInfo: 'District Information',
    cropInfo: 'Crop Information',
    waterRequirement: 'Water Requirement',
    npkRequirement: 'Nutrient Requirement',
    cropRequirements: 'Crop Information',
    temperatureRequirement: 'Temperature Requirement',
    humidityRequirement: 'Humidity Requirement',
    tempHumidity: 'Temperature and Humidity',
    compareCrops: 'Compare Crops',
    askCrop: 'Which crop?',
    askCropRec: 'Which crop?',
    askCompare: 'Which other crop should be compared?',
    noCrop: 'Which crop?',
    unsupportedDistrict: 'That district is not supported by the current dataset.',
    unsupportedCrop: 'That crop is not found in the dataset.',
    noRecs: 'No crop recommendations are available from the verified data.',
    reset: 'Reset',
    placeholder: 'Type your question in English',
    listening: 'Listening',
    loading: 'Loading',
    micDenied: 'Microphone access was denied. Allow it in the browser settings.',
    noSpeech: 'No speech was detected. Please try again.',
    voiceError: 'Voice recognition could not start. Please try again.',
    voiceUnsupported: 'Voice is not supported in this browser. Use Chrome or Edge.',
    ttsUnsupported: 'Voice playback is not supported in this browser.',
    modeData: 'Dataset',
    modePredict: 'Predict',
    title: 'Smart Coop Assistant',
    subtitle: 'Crop and district help'
  },
  Tamil: {
    greeting: 'வணக்கம். நான் உங்கள் விவசாய உதவியாளர். தரவுத்தளத்தில் உள்ள பயிர் மற்றும் மாவட்டத் தகவல்களைத் தருவேன்.',
    districtBtn: 'மாவட்டம்',
    askDistrict: 'ஒரு மாவட்டத்தைத் தேர்ந்தெடுக்கவும்.',
    selectDistrict: 'மாவட்டத்தைத் தேர்வு செய்க.',
    cropRecommendations: 'பயிர் பரிந்துரைகள்',
    districtInfo: 'மாவட்டத் தகவல்',
    cropInfo: 'பயிர் தகவல்',
    waterRequirement: 'நீர் தேவை',
    npkRequirement: 'ஊட்டச்சத்துத் தேவை',
    cropRequirements: 'பயிர் தகவல்',
    temperatureRequirement: 'வெப்பநிலைத் தேவை',
    humidityRequirement: 'ஈரப்பதத் தேவை',
    tempHumidity: 'வெப்பநிலை மற்றும் ஈரப்பதம்',
    compareCrops: 'பயிர்களை ஒப்பிடுக',
    askCrop: 'எந்தப் பயிர்?',
    askCropRec: 'எந்தப் பயிர்?',
    askCompare: 'ஒப்பிட வேண்டிய மற்ற பயிரைத் தேர்ந்தெடுக்கவும்.',
    noCrop: 'எந்தப் பயிர்?',
    unsupportedDistrict: 'அந்த மாவட்டம் தற்போதைய தரவுத்தளத்தில் இல்லை.',
    unsupportedCrop: 'அந்தப் பயிர் தரவுத்தளத்தில் இல்லை.',
    noRecs: 'சரிபார்க்கப்பட்ட தரவில் பயிர் பரிந்துரைகள் இல்லை.',
    reset: 'மீட்டமை',
    placeholder: 'தமிழில் கேளுங்கள்',
    listening: 'கேட்கிறது',
    loading: 'ஏற்றுகிறது',
    micDenied: 'ஒலிவாங்கி அனுமதி மறுக்கப்பட்டது. உலாவி அமைப்புகளில் அனுமதிக்கவும்.',
    noSpeech: 'பேச்சு கண்டறியப்படவில்லை. மீண்டும் முயற்சிக்கவும்.',
    voiceError: 'குரல் அடையாளம் தொடங்கவில்லை. மீண்டும் முயற்சிக்கவும்.',
    voiceUnsupported: 'இந்த உலாவியில் குரல் ஆதரிக்கப்படவில்லை. க்ரோம் அல்லது எட்ஜ் பயன்படுத்தவும்.',
    ttsUnsupported: 'இந்த உலாவியில் குரல் பதில் ஆதரிக்கப்படவில்லை.',
    modeData: 'தரவு',
    modePredict: 'கணிப்பு',
    title: 'விவசாய உதவியாளர்',
    subtitle: 'பயிர் மற்றும் மாவட்ட உதவி'
  }
};

export function resolveFormLang(language) {
  return language === 'Tamil' ? 'Tamil' : 'English'
}

export function rawDataStrings(language) {
  return RAW_DATA_STRINGS[resolveFormLang(language)];
}

// Prediction form strings (for ML soil prediction flow)
const FORM_STRINGS = {
  English: {
    formTitle: '🌱 Soil Prediction',
    formSubtitle: 'Fill every field, then press Predict. The trained model runs only after all 8 values are valid.',
    district: 'District',
    crop: 'Crop',
    temperature: 'Temperature (°C)',
    humidity: 'Humidity (%)',
    moisture: 'Moisture (%)',
    n: 'N Value',
    p: 'P Value',
    k: 'K Value',
    ph_district: 'Select district',
    ph_crop: 'Select crop',
    ph_temperature: 'Example: 35',
    ph_humidity: 'Example: 40',
    ph_moisture: 'Example: 30',
    ph_n: 'Example: 0.5',
    ph_p: 'Example: 0',
    ph_k: 'Example: 0.5',
    npkHint: 'Enter 0, 0.5 or 1',
    predict: 'Predict',
    startNew: '↺ Start New Prediction',
    requiredTemplate: '{field} is required before prediction.',
    invalidNumberTemplate: '{field} must be a valid number.',
    invalidNPKTemplate: '{field} must be 0, 0.5, or 1.',
    fieldNames: {
      district: 'District', crop: 'Crop', temperature: 'Temperature',
      humidity: 'Humidity', moisture: 'Moisture',
      n: 'N Value', p: 'P Value', k: 'K Value'
    }
  },
  Tamil: {
    formTitle: 'மண் கணிப்பு',
    formSubtitle: 'அனைத்து புலங்களையும் நிரப்பி பின்னர் கணி என அழுத்தவும். எட்டு மதிப்புகளும் சரியாக இருந்தால் மட்டுமே கணிப்பு நடைபெறும்.',
    district: 'மாவட்டம்',
    crop: 'பயிர்',
    temperature: 'வெப்பநிலை',
    humidity: 'காற்றின் ஈரப்பதம்',
    moisture: 'மண் ஈரப்பதம்',
    n: 'நைட்ரஜன் மதிப்பு',
    p: 'பாஸ்பரஸ் மதிப்பு',
    k: 'பொட்டாசியம் மதிப்பு',
    ph_district: 'மாவட்டத்தைத் தேர்வு செய்க',
    ph_crop: 'பயிரைத் தேர்வு செய்க',
    ph_temperature: 'எடுத்துக்காட்டு: 35',
    ph_humidity: 'எடுத்துக்காட்டு: 40',
    ph_moisture: 'எடுத்துக்காட்டு: 30',
    ph_n: 'எடுத்துக்காட்டு: 0.5',
    ph_p: 'எடுத்துக்காட்டு: 0',
    ph_k: 'எடுத்துக்காட்டு: 0.5',
    npkHint: '0 அல்லது 0.5 அல்லது 1 மட்டும்',
    predict: 'கணி',
    startNew: 'புதிய கணிப்பு',
    requiredTemplate: 'கணிப்புக்கு முன் {field} தேவை.',
    invalidNumberTemplate: '{field} சரியான எண்ணாக இருக்க வேண்டும்.',
    invalidNPKTemplate: '{field} 0 அல்லது 0.5 அல்லது 1 ஆக இருக்க வேண்டும்.',
    fieldNames: {
      district: 'மாவட்டம்', crop: 'பயிர்', temperature: 'வெப்பநிலை',
      humidity: 'காற்றின் ஈரப்பதம்', moisture: 'மண் ஈரப்பதம்',
      n: 'நைட்ரஜன் மதிப்பு', p: 'பாஸ்பரஸ் மதிப்பு', k: 'பொட்டாசியம் மதிப்பு'
    }
  }
};

export function formStrings(language) {
  return FORM_STRINGS[resolveFormLang(language)];
}

// ============================================================================
// CONTEXTUAL ACTION GENERATOR
// Generates ONLY valid actions based on current chatbot context.
// ============================================================================
export function getContextualActions(context, language) {
  const hasDistrict = context && context.district && context.district.trim() !== '';
  const hasCrop = context && context.crop && context.crop.trim() !== '';
  const S = rawDataStrings(language);

  if (!hasDistrict) {
    return [{ action: 'SELECT_DISTRICT', label: S.districtBtn }];
  }

  const actions = [
    { action: 'CROP_RECOMMENDATIONS', label: S.cropRecommendations, message: S.cropRecommendations },
    { action: 'DISTRICT_INFO', label: S.districtInfo, message: S.districtInfo }
  ];

  if (hasCrop) {
    actions.push({ action: 'CROP_INFO', label: S.cropInfo, message: S.cropInfo });
    actions.push({ action: 'WATER_REQUIREMENT', label: S.waterRequirement, message: S.waterRequirement });
    actions.push({ action: 'NPK_REQUIREMENT', label: S.npkRequirement, message: S.npkRequirement });
    actions.push({ action: 'TEMPERATURE_REQUIREMENT', label: S.temperatureRequirement, message: S.temperatureRequirement });
    actions.push({ action: 'HUMIDITY_REQUIREMENT', label: S.humidityRequirement, message: S.humidityRequirement });
    actions.push({ action: 'COMPARE_CROPS', label: S.compareCrops, message: S.compareCrops });
  }

  return actions;
}

export function getActionLabel(action, language) {
  const S = rawDataStrings(language);
  const map = {
    SELECT_DISTRICT: S.districtBtn,
    CROP_RECOMMENDATIONS: S.cropRecommendations,
    DISTRICT_INFO: S.districtInfo,
    WATER_REQUIREMENT: S.waterRequirement,
    NPK_REQUIREMENT: S.npkRequirement,
    CROP_REQUIREMENTS: S.cropInfo,
    CROP_INFO: S.cropInfo,
    TEMP_HUMIDITY: S.tempHumidity,
    TEMPERATURE_REQUIREMENT: S.temperatureRequirement,
    HUMIDITY_REQUIREMENT: S.humidityRequirement,
    COMPARE_CROPS: S.compareCrops
  };
  return map[action] || action;
}

export function matchDistrictValue(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (TAMIL_DISTRICTS[t]) return TAMIL_DISTRICTS[t];
  const found = [...new Set(Object.values(TAMIL_DISTRICTS))].find((d) => d.toLowerCase() === t.toLowerCase());
  return found || null;
}

export function matchCropValue(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (TAMIL_CROPS[t]) return TAMIL_CROPS[t];
  const found = [...new Set(Object.values(TAMIL_CROPS))].find((c) => String(c).toLowerCase() === t.toLowerCase());
  return found || null;
}

export function detectRawAction(text, language) {
  const t = String(text || '').trim();
  if (!t) return null;
  const S = rawDataStrings(language);
  const pairs = [
    [S.districtBtn, 'SELECT_DISTRICT'],
    [S.cropRecommendations, 'CROP_RECOMMENDATIONS'],
    [S.districtInfo, 'DISTRICT_INFO'],
    [S.cropInfo, 'CROP_INFO'],
    [S.cropRequirements, 'CROP_INFO'],
    [S.waterRequirement, 'WATER_REQUIREMENT'],
    [S.npkRequirement, 'NPK_REQUIREMENT'],
    [S.temperatureRequirement, 'TEMPERATURE_REQUIREMENT'],
    [S.humidityRequirement, 'HUMIDITY_REQUIREMENT'],
    [S.tempHumidity, 'TEMP_HUMIDITY'],
    [S.compareCrops, 'COMPARE_CROPS'],
    ['District', 'SELECT_DISTRICT'],
    ['மாவட்டம்', 'SELECT_DISTRICT'],
    ['Crop Recommendations', 'CROP_RECOMMENDATIONS'],
    ['Water Requirement', 'WATER_REQUIREMENT'],
    ['Which crop?', 'SELECT_CROP']
  ];
  const lower = t.toLowerCase();
  for (const [label, action] of pairs) {
    if (t === label || lower === String(label).toLowerCase()) return action;
  }
  return null;
}

// ============================================================================
// PREDICTION FORM VALIDATION (preserved for ML flow)
// ============================================================================
function fill(template, field) {
  return String(template).replace('{field}', field);
}

function parseNumeric(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

export function validatePredictionForm(fields, language) {
  const S = formStrings(language);
  const errors = {};
  const missing = [];
  const values = {};
  const fn = S.fieldNames;

  if (!fields.district || !String(fields.district).trim()) {
    missing.push('district');
    errors.district = fill(S.requiredTemplate, fn.district);
  }
  if (!fields.crop || !String(fields.crop).trim()) {
    missing.push('crop');
    errors.crop = fill(S.requiredTemplate, fn.crop);
  }
  for (const key of NUMERIC_FIELD_KEYS) {
    const raw = fields[key];
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      missing.push(key);
      errors[key] = fill(S.requiredTemplate, fn[key]);
      continue;
    }
    const v = parseNumeric(raw);
    if (Number.isNaN(v)) {
      errors[key] = fill(S.invalidNumberTemplate, fn[key]);
      continue;
    }
    if ((key === 'n' || key === 'p' || key === 'k') && !VALID_NPK.includes(v)) {
      errors[key] = fill(S.invalidNPKTemplate, fn[key]);
      continue;
    }
    values[key] = v;
  }
  return { complete: Object.keys(errors).length === 0, errors, missing, values };
}

export function buildPredictionMessage(fields) {
  const c = canonicalizeForm(fields);
  return `District: ${String(c.district).trim()} Crop: ${String(c.crop).trim()} Temperature: ${String(c.temperature).trim()} Humidity: ${String(c.humidity).trim()} Moisture: ${String(c.moisture).trim()} N: ${String(c.n).trim()} P: ${String(c.p).trim()} K: ${String(c.k).trim()}`;
}

function normalizeSpokenNumbers(text) {
  let out = String(text || '');
  out = out.replace(/\bzero\s*point\s*five\b/gi, '0.5');
  out = out.replace(/\bzero\s*point\s*zero\b/gi, '0.0');
  out = out.replace(/\bone\s*point\s*zero\b/gi, '1.0');
  out = out.replace(/\bpoint\s*five\b/gi, '0.5');
  out = out.replace(/\bhalf\b/gi, '0.5');
  out = out.replace(/\bzero\b/gi, '0');
  out = out.replace(/\bone\b/gi, '1');
  return out;
}
function hasNumericLabels(text) {
  return /(temperature|temp\b|humidity|humid|hum\b|moisture|moist|nitrogen|\bn\s*score\b|\bn\s*value\b|phosphorus|\bp\s*score\b|\bp\s*value\b|potassium|\bk\s*score\b|\bk\s*value\b|n_score|p_score|k_score|\bnpk\b)/i.test(text);
}
export function parseTranscriptToForm(transcript, current) {
  const base = { ...emptyPredictionForm(), ...(current || {}) };
  const text = normalizeSpokenNumbers(transcript || '');
  const labeled = {
    temperature: /(?:temperature|temp)\s*(?:[:=]|is)?\s*(-?\d+(?:\.\d+)?)/i,
    humidity: /(?:humidity|humid|hum)\s*(?:[:=]|is)?\s*(-?\d+(?:\.\d+)?)/i,
    moisture: /(?:moisture|moist)\s*(?:[:=]|is)?\s*(-?\d+(?:\.\d+)?)/i,
    n: /(?:n_score|nitrogen\s*score|nitrogen\s*value|nitrogen|n\s*value|n\s*score|\bn)\s*(?:[:=]|is)?\s*(-?\d+(?:\.\d+)?)/i,
    p: /(?:p_score|phosphorus\s*score|phosphorus\s*value|phosphorus|p\s*value|p\s*score|\bp)\s*(?:[:=]|is)?\s*(-?\d+(?:\.\d+)?)/i,
    k: /(?:k_score|potassium\s*score|potassium\s*value|potassium|k\s*value|k\s*score|\bk)\s*(?:[:=]|is)?\s*(-?\d+(?:\.\d+)?)/i
  };
  for (const [key, re] of Object.entries(labeled)) {
    const m = text.match(re);
    if (m && (base[key] === '' || base[key] === null || base[key] === undefined)) {
      base[key] = m[1];
    }
  }
  if (!hasNumericLabels(text)) {
    const nums = (text.match(/-?\d+(?:\.\d+)?/g) || []);
    const emptySlots = POSITIONAL_ORDER.filter((k) => base[k] === '' || base[k] === null || base[k] === undefined);
    nums.slice(0, emptySlots.length).forEach((num, i) => {
      base[emptySlots[i]] = num;
    });
  }
  return base;
}
