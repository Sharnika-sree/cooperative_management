// =========================================================================
// Shared Chatbot service: single place for chatbot API access.
// Used by the floating widget, the assistant page, and any future chatbot.
// =========================================================================
import axios from 'axios'

export * from './predictionForm'

// POST /api/chatbot — one call per user message, exactly one reply expected.
export async function sendChatMessage({ message, language, mode, sessionMemory, action }) {
  const res = await axios.post('/api/chatbot', {
    message,
    language,
    mode,
    sessionMemory,
    action
  })
  return res.data
}

// GET /api/soil/meta — districts + crops for the prediction dropdowns.
// Cached in-module so every chatbot UI shares one fetch.
let metaCache = null
let metaPromise = null
export function fetchSoilMeta() {
  if (metaCache) return Promise.resolve(metaCache)
  if (metaPromise) return metaPromise
  metaPromise = axios.get('/api/soil/meta')
    .then((res) => {
      metaCache = {
        districts: res.data?.districts || [],
        crops: res.data?.crops || []
      }
      return metaCache
    })
    .catch((err) => {
      metaPromise = null
      throw err
    })
  return metaPromise
}

// TTS must speak ONLY the generated answer text — never markup or UI text.
export function cleanTtsText(text) {
  return String(text || '').replace(/[*#_`]/g, '').trim()
}

// Build a clean, concise voice summary from a soil prediction result.
export function buildVoiceSummary(soilResult, language) {
  if (!soilResult || !soilResult.prediction) return ''
  const isTamil = language === 'Tamil'
  const verdict = soilResult.prediction
  const crop = soilResult.crop || ''
  const district = soilResult.district || ''
  const factors = soilResult.factors || {}
  const suggestions = soilResult.suggestions || []

  const factorNames = {
    temperature: isTamil ? 'வெப்பநிலை' : 'Temperature',
    humidity: isTamil ? 'ஈரப்பதம்' : 'Humidity',
    moisture: isTamil ? 'மண் ஈரப்பதம்' : 'Moisture',
    nitrogen: isTamil ? 'நைட்ரஜன்' : 'Nitrogen',
    phosphorus: isTamil ? 'பாஸ்பரஸ்' : 'Phosphorus',
    potassium: isTamil ? 'பொட்டாசியம்' : 'Potassium'
  }

  const statusWords = {
    Suitable: isTamil ? 'ஏற்றது' : 'suitable',
    'Needs Improvement': isTamil ? 'மேம்படுத்த வேண்டும்' : 'needs improvement',
    Moderate: isTamil ? 'மிதமான' : 'moderate',
    Low: isTamil ? 'குறைவாக' : 'low',
    High: isTamil ? 'உயர்ந்த' : 'high'
  }

  const factorParts = Object.entries(factors)
    .filter(([, f]) => f.status && f.status !== 'Suitable')
    .map(([key, f]) => `${factorNames[key] || key}: ${statusWords[f.status] || f.status}`)

  let summary = ''
  if (isTamil) {
    summary = `${crop} பயிர், ${district} மாவட்டத்தில் நிலம் ${verdict === 'Suitable' ? 'ஏற்றது' : verdict === 'Needs Improvement' ? 'மேம்படுத்த வேண்டும்' : 'ஏற்றதல்ல'}.`
    if (factorParts.length > 0) {
      summary += ` குறைவான காரணிகள்: ${factorParts.join(', ')}.`
    } else {
      summary += ' அனைத்து காரணிகளும் நல்ல நிலையில்.'
    }
    if (suggestions.length > 0) {
      summary += ` ${suggestions[0]}`
    }
  } else {
    summary = `${crop} in ${district} is ${verdict.toLowerCase()}.`
    if (factorParts.length > 0) {
      summary += ` Key factors: ${factorParts.join(', ')}.`
    } else {
      summary += ' All factors are suitable.'
    }
    if (suggestions.length > 0) {
      summary += ` ${suggestions[0]}`
    }
  }
  return cleanTtsText(summary)
}

// Build a clean voice summary for raw-data chatbot responses.
export function buildRawDataVoiceSummary(response, language) {
  if (!response) return ''
  const isTamil = language === 'Tamil'
  const text = isTamil ? response : response
  return cleanTtsText(text)
}
