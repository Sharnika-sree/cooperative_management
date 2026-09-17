const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const prisma = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const soilService = require('../Services/soilService');

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

// Helper: Check if text contains Tamil characters
function isTamilText(text) {
  return /[\u0B80-\u0BFF]/.test(text);
}

// Helper: Extract district from text or aliases
function extractDistrictFromText(text) {
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
  const clean = text.toLowerCase();
  for (const [alias, standard] of Object.entries(soilService.cropAliases)) {
    const regex = new RegExp(`\\b${alias}\\b`, 'i');
    if (regex.test(clean) || clean.includes(alias)) {
      return standard;
    }
  }
  for (const c of soilService.cropsSet) {
    const regex = new RegExp(`\\b${c.toLowerCase()}\\b`, 'i');
    if (regex.test(clean) || clean.includes(c.toLowerCase())) {
      return c;
    }
  }
  return null;
}

// Helper: Extract manual NPK & sensor values from natural language
function extractManualValues(text) {
  const nMatch = text.match(/(?:nitrogen|n\b|n\s*[:=]|n\s+is)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const pMatch = text.match(/(?:phosphorus|p\b|p\s*[:=]|p\s+is)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const kMatch = text.match(/(?:potassium|potash|k\b|k\s*[:=]|k\s+is)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const tempMatch = text.match(/(?:temperature|temp\b|temp\s*[:=]|temp\s+is)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const humMatch = text.match(/(?:humidity|hum\b|hum\s*[:=]|humidity\s+is)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const moistMatch = text.match(/(?:moisture|moist\b|moisture\s*[:=]|moisture\s+is)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const soilTypeMatch = text.match(/(?:soil\s*type|soil)\s*[:=]?\s*([a-zA-Z\s]+?\bsoil\b|[a-zA-Z]+)/i);

  // Check NPK list format like "NPK is 45, 30, 40" or "45, 30, 40"
  const npkListMatch = text.match(/npk\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)\s*[,:\s]\s*(\d+(?:\.\d+)?)\s*[,:\s]\s*(\d+(?:\.\d+)?)/i);

  let n = nMatch ? parseFloat(nMatch[1]) : (npkListMatch ? parseFloat(npkListMatch[1]) : null);
  let p = pMatch ? parseFloat(pMatch[1]) : (npkListMatch ? parseFloat(npkListMatch[2]) : null);
  let k = kMatch ? parseFloat(kMatch[1]) : (npkListMatch ? parseFloat(npkListMatch[3]) : null);
  let temp = tempMatch ? parseFloat(tempMatch[1]) : null;
  let hum = humMatch ? parseFloat(humMatch[1]) : null;
  let moist = moistMatch ? parseFloat(moistMatch[1]) : null;

  if (n !== null || p !== null || k !== null || temp !== null || hum !== null || moist !== null) {
    return {
      hasValues: true,
      nitrogen: n ?? 45,
      phosphorus: p ?? 30,
      potassium: k ?? 40,
      temperature: temp ?? 28,
      humidity: hum ?? 65,
      moisture: moist ?? 3.5,
      soilType: soilTypeMatch ? soilTypeMatch[1].trim() : 'Red Soil'
    };
  }
  return { hasValues: false };
}

// 3. Process chatbot messages
router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const query = message.trim();
    const queryLower = query.toLowerCase();
    const isTamil = isTamilText(query);

    // Fetch user/farmer profile with safe fallback
    let farmer = null;
    if (req.user && req.user.role === 'FARMER') {
      try {
        farmer = await prisma.farmer.findUnique({
          where: { userId: req.user.id }
        });
      } catch (err) {
        // Fallback gracefully if database connection is pending/unreachable
        farmer = null;
      }
    }

    const userDistrict = farmer?.district || (farmer?.village ? extractDistrictFromText(farmer.village) : null);
    const extractedDistrict = extractDistrictFromText(query) || userDistrict;
    const extractedCrop = extractCropFromText(query) || (farmer?.crop ? extractCropFromText(farmer.crop) : null);

    // =========================================================================
    // DETERMINISTIC SOIL INTENT DETECTION & DIRECT RESPONSES
    // =========================================================================

    // 1. Manual / IoT Soil Values Check (e.g. "My N is 45, P is 30, K is 40...")
    const manualData = extractManualValues(query);
    if (manualData.hasValues || queryLower.includes('npk') || queryLower.includes('my soil has nitrogen')) {
      const targetCrop = extractedCrop || 'groundnut';
      const targetDistrict = extractedDistrict || 'Salem';

      const result = await soilService.checkManualSoilSuitability({
        district: targetDistrict,
        soilType: manualData.soilType || 'Red Soil',
        crop: targetCrop,
        nitrogen: manualData.nitrogen,
        phosphorus: manualData.phosphorus,
        potassium: manualData.potassium,
        temperature: manualData.temperature,
        humidity: manualData.humidity,
        moisture: manualData.moisture
      });

      if (result.success) {
        let textResponse = '';
        if (isTamil) {
          textResponse = `🌱 **மண் மற்றும் பயிர் பொருத்தம் பகுப்பாய்வு முடிவு**

🌾 **பயிர்:** ${result.crop}
📍 **மாவட்டம்:** ${result.district}
🧪 **மண் வகை:** ${result.soilType} (${result.soilTypeNote})

📊 **உள்ளீடு விவரங்கள்:**
• தழைச்சத்து (N): ${result.inputs.nitrogen} mg/kg
• மணிச்சத்து (P): ${result.inputs.phosphorus} mg/kg
• சாம்பல்ச்சத்து (K): ${result.inputs.potassium} mg/kg
• வெப்பநிலை: ${result.inputs.temperature}°C
• ஈரப்பதம்: ${result.inputs.humidity}%
• மண் ஈரப்பதம்: ${result.inputs.moisture}%

🏆 **பொருத்த மதிப்பெண்:** ${result.scores.overallSuitabilityScore}/100
📌 **முடிவு:** ${result.classification === 'Suitable' ? 'பொருத்தமானது' : result.classification === 'Needs Improvement' ? 'மேம்படுத்தப்பட வேண்டும்' : 'பொருத்தமற்றது'} ${result.statusEmoji}

💡 **நன்மைகள்:**
${result.strengths.map(s => `• ${s}`).join('\n')}

⚠️ **மேம்படுத்த வேண்டியவை:**
${result.improvements.length > 0 ? result.improvements.map(i => `• ${i}`).join('\n') : '• அனைத்து அளவுகளும் உகந்த நிலையில் உள்ளன.'}

🌱 **பரிந்துரை:**
${result.recommendation}

*(இந்த முடிவு Smart Coop மண் பகுப்பாய்வு தரவுத்தளத்தை அடிப்படையாகக் கொண்டது)*`;
        } else {
          textResponse = `🌱 **Soil Suitability Result**

**Crop:** ${result.crop.charAt(0).toUpperCase() + result.crop.slice(1)}
**District:** ${result.district}
**Soil Type:** ${result.soilType}

**Input Parameters:**
• Nitrogen (N): ${result.inputs.nitrogen} mg/kg
• Phosphorus (P): ${result.inputs.phosphorus} mg/kg
• Potassium (K): ${result.inputs.potassium} mg/kg
• Temperature: ${result.inputs.temperature}°C
• Humidity: ${result.inputs.humidity}%
• Moisture: ${result.inputs.moisture}%

**Suitability Score:** ${result.scores.overallSuitabilityScore}/100
**Classification:** ${result.classification} ${result.statusEmoji}

**Key Strengths:**
${result.strengths.map(s => `• ${s}`).join('\n')}

**Areas to Improve:**
${result.improvements.length > 0 ? result.improvements.map(i => `• ${i}`).join('\n') : '• All nutrient and environmental parameters are in optimal range.'}

**Recommendation:**
${result.recommendation}

*(Analysis generated from Smart Coop Soil Suitability Dataset)*`;
        }
        return res.json({ response: textResponse, soilData: result });
      }
    }

    // 2. Water Requirement Query (e.g. "What is the water requirement for rice in Thanjavur?")
    if (
      queryLower.includes('water requirement') || 
      queryLower.includes('water need') || 
      queryLower.includes('how much water') || 
      queryLower.includes('தண்ணீர் தேவை') || 
      queryLower.includes('நீர் தேவை') ||
      queryLower.includes('water req') ||
      (queryLower.includes('water') && extractedCrop)
    ) {
      if (extractedCrop) {
        const waterResult = await soilService.getWaterRequirement(extractedCrop, extractedDistrict);
        if (waterResult.success) {
          let responseText = '';
          if (isTamil) {
            responseText = `💧 **தண்ணீர் தேவை விவரம் (${waterResult.crop}):**\n\n${waterResult.crop} பயிருக்கான தண்ணீர் தேவை அளவு: **${waterResult.waterRequirement}**.\n\n${waterResult.isNumeric ? `சுமார் ${waterResult.waterRequirement} மி.மீ பாசன நீர் தேவைப்படுகிறது.` : `நீர் பாசன மேலாண்மைக்கு ${waterResult.waterRequirement} நீர் அளவு உகந்தது.`}`;
          } else {
            responseText = `💧 **Water Requirement for ${waterResult.crop.charAt(0).toUpperCase() + waterResult.crop.slice(1)}:**\n\n${waterResult.formattedRequirement}\n\n• Crop: ${waterResult.crop}\n• Required Level: ${waterResult.waterRequirement}`;
          }
          return res.json({ response: responseText });
        }
      }
    }

    // 3. Climate (Temperature / Humidity) Requirement Query
    if (
      (queryLower.includes('temperature') && queryLower.includes('humidity')) ||
      queryLower.includes('climate') ||
      queryLower.includes('weather requirement') ||
      queryLower.includes('வெப்பநிலை') ||
      queryLower.includes('ஈரப்பதம்')
    ) {
      if (extractedCrop) {
        const climateResult = await soilService.getCropClimate(extractedCrop, extractedDistrict);
        if (climateResult.success) {
          let responseText = '';
          if (isTamil) {
            responseText = `🌤️ **காலநிலை மற்றும் சுற்றுச்சூழல் விவரங்கள் (${climateResult.crop}):**\n\n• உகந்த வெப்பநிலை வரம்பு: **${climateResult.cropRequirements.minTemperature}°C – ${climateResult.cropRequirements.maxTemperature}°C**\n• உகந்த ஈரப்பதம் வரம்பு: **${climateResult.cropRequirements.minHumidity}% – ${climateResult.cropRequirements.maxHumidity}%**\n\n${climateResult.recordedClimate ? `📍 ${climateResult.recordedClimate.district} மாவட்டத்தில் பதிவான சராசரி வெப்பநிலை: ${climateResult.recordedClimate.avgTemperature}°C மற்றும் ஈரப்பதம்: ${climateResult.recordedClimate.avgHumidity}%.` : ''}`;
          } else {
            responseText = `🌤️ **Climate Requirements for ${climateResult.crop.charAt(0).toUpperCase() + climateResult.crop.slice(1)}:**\n\n• Preferred Temperature Range: **${climateResult.cropRequirements.minTemperature}°C – ${climateResult.cropRequirements.maxTemperature}°C**\n• Preferred Humidity Range: **${climateResult.cropRequirements.minHumidity}% – ${climateResult.cropRequirements.maxHumidity}%**\n\n${climateResult.recordedClimate ? `📍 **Recorded District Climate (${climateResult.recordedClimate.district}):**\n- Average Temperature: ${climateResult.recordedClimate.avgTemperature}°C\n- Average Humidity: ${climateResult.recordedClimate.avgHumidity}%\n- Average Moisture: ${climateResult.recordedClimate.avgMoisture}%` : ''}\n\n${climateResult.explanation}`;
          }
          return res.json({ response: responseText });
        }
      }
    }

    // 4. Crop Recommendation Query (e.g. "What crop is suitable in Salem?", "Which crop is suitable here?")
    if (
      queryLower.includes('what crop is suitable') ||
      queryLower.includes('which crop is suitable') ||
      queryLower.includes('what crop is best') ||
      queryLower.includes('which crop is best') ||
      queryLower.includes('recommend a crop') ||
      queryLower.includes('what can i grow') ||
      queryLower.includes('crops suitable in') ||
      queryLower.includes('crop suitable in') ||
      queryLower.includes('crop suitable here') ||
      queryLower.includes('பயிர் ஏற்றது') ||
      queryLower.includes('பயிர் பரிந்துரை') ||
      queryLower.includes('என்ன பயிர்') ||
      queryLower.includes('enna crop suitable') ||
      queryLower.includes('suitable here')
    ) {
      if (!extractedDistrict) {
        const askMsg = isTamil 
          ? "நீங்கள் எந்த மாவட்டத்தில் விவசாயம் செய்கிறீர்கள்? மாவட்டத்தின் பெயரை குறிப்பிட்டால் (எ.கா. சேலம், தஞ்சாவூர், ஈரோடு) மிகவும் பொருத்தமான பயிர்களை வரிசைப்படுத்தி பரிந்துரைக்க முடியும்."
          : "Which district are you farming in? Please specify your district (e.g., Salem, Thanjavur, Coimbatore) so I can rank and recommend the most suitable crops for your soil.";
        return res.json({ response: askMsg });
      }

      const recResult = await soilService.getSuitableCrops(extractedDistrict);
      if (recResult.success) {
        let responseText = '';
        if (isTamil) {
          responseText = `🌾 **${recResult.district} மாவட்டத்திற்கு ஏற்ற சிறந்த பயிர்கள்:**\n\n${recResult.topCrops.slice(0, 5).map((c, i) => `${i + 1}. **${c.crop}** — பொருத்த மதிப்பெண்: **${c.avgSuitabilityScore}/100** (${c.suitablePercentage}% பதிவுகள் உகந்தது) | நீர் தேவை: ${c.waterRequirement}`).join('\n')}\n\n💡 உங்கள் குறிப்பிட்ட நிலத்தின் NPK மற்றும் பாசன வசதியை பொறுத்து சிறந்த பயிரை தேர்வு செய்யலாம்.`;
        } else {
          responseText = `🌾 **Recommended Crops for ${recResult.district}:**\n\nBased on soil suitability records in **${recResult.district}**, here are the top ranked crops:\n\n${recResult.topCrops.slice(0, 6).map((c, i) => `${i + 1}. **${c.crop.charAt(0).toUpperCase() + c.crop.slice(1)}**\n   • Suitability Score: **${c.avgSuitabilityScore}/100** (${c.suitablePercentage}% Suitable)\n   • Water Requirement: ${c.waterRequirement}\n   • Temperature Range: ${c.temperatureRange}`).join('\n\n')}\n\n📌 *Recommendation:* **${recResult.primaryRecommendation?.crop}** has the highest average suitability score in ${recResult.district}.`;
        }
        return res.json({ response: responseText, cropsData: recResult });
      } else {
        return res.json({ response: recResult.error });
      }
    }

    // 5. Crop Suitability in District / Soil Check (e.g. "Is groundnut suitable for Salem?", "Check my soil for rice")
    if (
      queryLower.includes('suitable') || 
      queryLower.includes('suitability') || 
      queryLower.includes('grow') || 
      queryLower.includes('ஏற்றதா') || 
      queryLower.includes('பயிரிடலாமா') ||
      queryLower.includes('suitable ah') ||
      queryLower.includes('check my soil')
    ) {
      if (extractedCrop) {
        if (!extractedDistrict) {
          const askMsg = isTamil 
            ? `நீங்கள் எந்த மாவட்டத்தில் ${extractedCrop} பயிரிட திட்டமிட்டுள்ளீர்கள்? மாவட்டத்தின் பெயரை குறிப்பிடுங்கள் (எ.கா. சேலம், தஞ்சாவூர்).`
            : `Which district are you planning to grow ${extractedCrop} in? Please provide the district name (e.g., Salem, Thanjavur).`;
          return res.json({ response: askMsg });
        }

        const suitResult = await soilService.getCropSuitability(extractedCrop, extractedDistrict);
        if (suitResult.success) {
          let responseText = '';
          if (isTamil) {
            responseText = `🌱 **${suitResult.district} மாவட்டத்தில் ${suitResult.crop} பயிர் பொருத்தம்:**\n\n• நிலை: **${suitResult.classification === 'Suitable' ? 'பொருத்தமானது ✅' : suitResult.classification === 'Needs Improvement' ? 'மேம்படுத்தப்பட வேண்டும் ⚠️' : 'பொருத்தமற்றது ❌'}**\n• சராசரி பொருத்த மதிப்பெண்: **${suitResult.avgSuitabilityScore}/100**\n• பொருத்தமான கிராம பதிவுகள்: **${suitResult.suitablePercentage}%**\n\n📌 **சுற்றுச்சூழல் மற்றும் ஊட்டச்சத்து தேவைகள்:**\n• வெப்பநிலை வரம்பு: ${suitResult.cropRequirements.minTemp}°C – ${suitResult.cropRequirements.maxTemp}°C (மாவட்டத்தில் சராசரி: ${suitResult.climateRecorded.avgTemperature}°C)\n• ஈரப்பதம்: ${suitResult.cropRequirements.minHumidity}% – ${suitResult.cropRequirements.maxHumidity}% (மாவட்டத்தில் சராசரி: ${suitResult.climateRecorded.avgHumidity}%)\n• தண்ணீர் தேவை: ${suitResult.cropRequirements.waterReq}\n• தழைச்சத்து தேவை: ${suitResult.cropRequirements.nitrogenReq} | மணிச்சத்து: ${suitResult.cropRequirements.phosphorusReq} | சாம்பல்ச்சத்து: ${suitResult.cropRequirements.potassiumReq}\n\n💡 ${suitResult.summary}`;
          } else {
            responseText = `🌱 **Soil Suitability Analysis:**\n\n**Crop:** ${suitResult.crop.charAt(0).toUpperCase() + suitResult.crop.slice(1)}\n**District:** ${suitResult.district}\n**Status:** **${suitResult.classification}** ${suitResult.classification === 'Suitable' ? '✅' : suitResult.classification === 'Needs Improvement' ? '⚠️' : '❌'}\n**Suitability Score:** **${suitResult.avgSuitabilityScore}/100** (${suitResult.suitablePercentage}% of local soil records are suitable)\n\n📊 **Crop Requirements vs Recorded Environment:**\n• Temperature: ${suitResult.cropRequirements.minTemp}°C – ${suitResult.cropRequirements.maxTemp}°C (Recorded Avg: ${suitResult.climateRecorded.avgTemperature}°C)\n• Humidity: ${suitResult.cropRequirements.minHumidity}% – ${suitResult.cropRequirements.maxHumidity}% (Recorded Avg: ${suitResult.climateRecorded.avgHumidity}%)\n• Water Requirement: ${suitResult.cropRequirements.waterReq}\n• Soil pH Range: ${suitResult.cropRequirements.minPh} – ${suitResult.cropRequirements.maxPh}\n• Nutrient Requirements: N (${suitResult.cropRequirements.nitrogenReq}), P (${suitResult.cropRequirements.phosphorusReq}), K (${suitResult.cropRequirements.potassiumReq})\n\n💡 *Summary:* ${suitResult.summary}`;
          }
          return res.json({ response: responseText, suitabilityData: suitResult });
        } else {
          return res.json({ response: suitResult.error });
        }
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
      // Fallback context if database query is unavailable
      context = `
Cooperative Overview:
- Urea (Fertilizer): 250 Bags (Available in stock)
- DAP (Fertilizer): 180 Bags (Available in stock)
- Schemes Supported: PM-KISAN, PMFBY Crop Insurance, Drip Irrigation Subsidy
- Announcements: Fertilizer distribution scheduled this week for registered members.
`;
    }

    // Direct match for quick cooperative questions
    const mockCoop = getCoopMockResponse(query, context);
    if (mockCoop) {
      return res.json({ response: mockCoop });
    }

    // =========================================================================
    // GEMINI PROMPT & GENERATION (WITH COMPLETE COOPERATIVE + SOIL CONTEXT)
    // =========================================================================
    const systemPrompt = `
${chatbotConfig.prompt}

Cooperative General Knowledge:
${chatbotConfig.knowledge}

Cooperative Live Database Context:
${context}

User Question: ${query}

CRITICAL INSTRUCTIONS:
1. Answer the user question accurately using the live cooperative context, farmer profile, and agricultural knowledge.
2. If the user asks in Tamil, reply in helpful and natural Tamil. If asked in English or Tanglish, reply in English/Tanglish.
3. If the user asks questions completely off-topic (e.g. movie trivia, politics, software development, general math puzzles), reply politely with: "I'm sorry, I can only answer questions related to the cooperative society, government schemes, inventory, and agricultural soil suitability."
4. Keep the answer professional, concise, and helpful.
`;

    if (!genAI) {
      return res.json({
        response: getCoopMockResponse(query, context) || "I'm sorry, I can only answer questions related to the cooperative society and agricultural soil suitability. (Self-hosted rule-based fallback active)"
      });
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();
      res.json({ response: text });
    } catch (apiError) {
      console.error('Gemini API error, trying gemini-pro fallback:', apiError);
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text();
        res.json({ response: text });
      } catch (err) {
        console.error('All Gemini API models failed. Using rule-based fallback response:', err);
        res.json({
          response: getCoopMockResponse(query, context) || "I'm sorry, I can only answer questions related to the cooperative society and agricultural soil suitability."
        });
      }
    }
  } catch (error) {
    console.error('Chatbot route error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Helper for Cooperative Rule-Based Responses
function getCoopMockResponse(message, context) {
  const query = message.toLowerCase();

  if (query.includes('eligible') || query.includes('scheme') || query.includes('திட்டம்')) {
    if (context && context.includes('Eligible Schemes:')) {
      const schemesPart = context.split('Eligible Schemes:')[1].split('\n\n')[0].trim();
      return `Based on your profile, you are eligible for the following schemes:\n${schemesPart}`;
    }
    return "You can check your eligible schemes (such as PM-KISAN, PMFBY, and Drip Irrigation Subsidy) on the Government Schemes dashboard tab.";
  }

  if (query.includes('urea') || query.includes('fertilizer') || query.includes('dap') || query.includes('உரம்') || query.includes('stock') || query.includes('available')) {
    if (context && context.includes('Inventory Status')) {
      const inventoryPart = context.split('Inventory Status (Fertilizers, Seeds, Pesticides):')[1].split('\n\n')[0].trim();
      if (query.includes('urea')) {
        const line = inventoryPart.split('\n').find(l => l.toLowerCase().includes('urea'));
        return line ? `Urea status: ${line.substring(2)}` : "Urea is currently in stock at the cooperative society.";
      }
      if (query.includes('dap')) {
        const line = inventoryPart.split('\n').find(l => l.toLowerCase().includes('dap'));
        return line ? `DAP status: ${line.substring(2)}` : "DAP is currently in stock at the cooperative society.";
      }
      return `Current inventory stock status:\n${inventoryPart}`;
    }
    return "Yes, fertilizer stock (including Urea and DAP) is available at the cooperative society. You can check current quantity in the Inventory tab.";
  }

  if (query.includes('profile') || query.includes('my name') || query.includes('membership') || query.includes('சுயவிவரம்')) {
    if (context && context.includes('Farmer Profile:')) {
      const profilePart = context.split('Farmer Profile:')[1].split('\n\n')[0].trim();
      return `Here is your profile information:\n${profilePart}`;
    }
    return "Your farmer profile is registered with the Smart Cooperative Society. You can view full details on your dashboard.";
  }

  if (query.includes('announcement') || query.includes('news') || query.includes('update') || query.includes('அறிவிப்பு')) {
    if (context && context.includes('Recent Announcements:')) {
      const annPart = context.split('Recent Announcements:')[1].trim();
      return `Here are the latest announcements:\n${annPart}`;
    }
    return "Latest announcement: Fertilizer distribution and crop insurance subsidy applications are currently active at the society office.";
  }

  return null;
}

module.exports = router;
