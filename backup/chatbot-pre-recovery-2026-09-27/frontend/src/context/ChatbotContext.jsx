// =========================================================================
// Shared Chatbot context: ONE implementation used by every chatbot UI.
// Raw-data agricultural flow: District -> contextual actions -> info.
// ML Soil Prediction flow is preserved separately via mode='prediction'.
// Each UI mounts its own <ChatbotProvider> (independent conversation)
// while sharing this exact logic.
// =========================================================================
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
  sendChatMessage,
  fetchSoilMeta,
  cleanTtsText,
  buildVoiceSummary,
  buildRawDataVoiceSummary,
  emptyPredictionForm,
  validatePredictionForm,
  buildPredictionMessage,
  parseTranscriptToForm,
  getDistrictOptions,
  getCropOptions,
  canonicalizeForm,
  resolveFormLang,
  rawDataStrings,
  getContextualActions,
  getActionLabel
} from '../services/chatbotService'

const ChatbotContext = createContext(null)

const DEFAULT_GREETING = rawDataStrings('English').greeting
const DEFAULT_GREETING_TAMIL = rawDataStrings('Tamil').greeting

export function ChatbotProvider({ children, initialGreeting }) {
  // TWO MODES: 'normal' (raw-data flow) vs 'prediction' (ML soil model).
  // Raw-data flow starts with ONLY "District" and grows context-aware.
  const [mode, setMode] = useState('normal')
  const [lastLanguage, setLastLanguage] = useState('English')
  const [sessionMemory, setSessionMemory] = useState({
    lastLanguage: 'English',
    lastDistrict: null,
    lastCrop: null,
    predictionSession: null,
    mode: 'normal'
  })

  const [messages, setMessages] = useState([
    { role: 'bot', content: initialGreeting || (resolveFormLang('English') === 'Tamil' ? DEFAULT_GREETING_TAMIL : DEFAULT_GREETING) }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speakingIndex, setSpeakingIndex] = useState(null)
  const [voiceNotice, setVoiceNotice] = useState('')

  // Raw-data context: district, crop, and current stage
  const [district, setDistrict] = useState(null)
  const [crop, setCrop] = useState(null)

  // Guided prediction form state (preserved for ML flow)
  const [form, setForm] = useState(emptyPredictionForm())
  const [formErrors, setFormErrors] = useState({})
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [meta, setMeta] = useState({ districts: [], crops: [] })
  const [metaError, setMetaError] = useState('')

  const recognitionRef = useRef(null)

  const speechLang = lastLanguage === 'Tamil' ? 'ta-IN' : 'en-IN'

  // Determine the greeting based on current language
  const currentGreeting = resolveFormLang(lastLanguage) === 'Tamil' ? DEFAULT_GREETING_TAMIL : DEFAULT_GREETING

  useEffect(() => {
    // If language changed, update initial message
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'bot') {
        return [{ role: 'bot', content: currentGreeting }]
      }
      return prev
    })
  }, [lastLanguage])

  useEffect(() => {
    fetchSoilMeta().then(setMeta).catch(() => setMetaError('meta'))
  }, [])

  // ---- Voice input ----
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = speechLang

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceNotice(rawDataStrings(lastLanguage).listening)
      }

      recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }
        const transcript = finalTranscript || interimTranscript
        if (transcript) {
          setInput(transcript)
          // In prediction mode, spoken values fill the guided form.
          setMode((currentMode) => {
            if (currentMode === 'prediction') {
              setForm((prev) => parseTranscriptToForm(transcript, prev))
            }
            return currentMode
          })
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        if (event.error === 'not-allowed') {
          setVoiceNotice('Microphone access denied. Please allow permissions in your browser.')
        } else if (event.error === 'no-speech') {
          setVoiceNotice('No speech detected. Please try speaking again.')
        } else {
          setVoiceNotice(`Voice recognition error: ${event.error}`)
        }
        setTimeout(() => setVoiceNotice(''), 4000)
      }

      recognition.onend = () => {
        setIsListening(false)
        setVoiceNotice('')
      }

      recognitionRef.current = recognition
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechLang, lastLanguage])

  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.')
      return
    }
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.lang = speechLang
          recognitionRef.current.start()
        }
      } catch (e) {
        console.error('Failed to start speech recognition:', e)
      }
    }
  }

  // ---- Voice output ----
  const speakMessage = (msg, index) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.')
      return
    }
    window.speechSynthesis.cancel()
    if (speakingIndex === index) {
      setSpeakingIndex(null)
      return
    }

    const isSoil = msg.soilResult && msg.soilResult.prediction
    const textToSpeak = isSoil
      ? buildVoiceSummary(msg.soilResult, lastLanguage)
      : buildRawDataVoiceSummary(msg.ttsText || msg.content, lastLanguage)
    if (!textToSpeak) return
    const utterance = new SpeechSynthesisUtterance(textToSpeak)
    utterance.lang = speechLang
    utterance.onstart = () => setSpeakingIndex(index)
    utterance.onend = () => setSpeakingIndex(null)
    utterance.onerror = () => setSpeakingIndex(null)
    window.speechSynthesis.speak(utterance)
  }

  const handleLanguageChange = (newLang) => {
    if (newLang === 'Tanglish') return
    setLastLanguage(newLang)
    setSessionMemory((prev) => ({ ...prev, lastLanguage: newLang }))
  }

  // Determine contextual actions based on current state
  const contextualActions = getContextualActions({ district, crop }, lastLanguage)

  // ---- Send message ----
  const send = async (messageText, forceMode, action) => {
    const textToSend = messageText || input
    const activeMode = forceMode || mode
    const isStructuredAction = action === 'SELECT_DISTRICT'

    if (!isStructuredAction && !textToSend.trim()) return

    if (!isStructuredAction && textToSend.trim()) {
      setMessages((prev) => [...prev, { role: 'user', content: textToSend }])
    }
    if (!messageText && !isStructuredAction) setInput('')
    setLoading(true)

    try {
      const data = await sendChatMessage({
        message: isStructuredAction ? '' : textToSend,
        language: lastLanguage,
        mode: activeMode,
        sessionMemory: { ...sessionMemory, lastLanguage, mode: activeMode, district, crop },
        action: isStructuredAction ? action : undefined
      })

      setMessages((prev) => [...prev, {
        role: 'bot',
        content: data.response,
        ttsText: data.ttsText,
        soilResult: data.soilResult
      }])

      if (data.sessionMemory) {
        setSessionMemory(data.sessionMemory)
        if (data.sessionMemory.mode === 'prediction' || data.sessionMemory.mode === 'normal') {
          setMode(data.sessionMemory.mode)
        }
        if (data.sessionMemory.district) setDistrict(data.sessionMemory.district)
        if (data.sessionMemory.crop) setCrop(data.sessionMemory.crop)
      }
    } catch (error) {
      console.error(error)
      const errReply = lastLanguage === 'Tamil'
        ? 'மன்னித்துக் கொள்ளுங்கள், சேவையில் தற்காலிகத் தடை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.'
        : 'Sorry, I encountered an issue. Please try again.'
      setMessages((prev) => [...prev, { role: 'bot', content: errReply, ttsText: errReply }])
    } finally {
      setLoading(false)
    }
  }

  // ---- Mode selection ----
  const selectMode = async (newMode) => {
    setMode(newMode)
    if (newMode === 'prediction') {
      setForm(emptyPredictionForm())
      setFormErrors({})
      setFormSubmitted(false)
      setSessionMemory((prev) => ({ ...prev, mode: newMode, prediction: null, predictionSession: null }))
      setDistrict(null)
      setCrop(null)
      await send('Soil Prediction', 'prediction')
    } else {
      // Reset raw-data context when switching back to normal
      setDistrict(null)
      setCrop(null)
      setSessionMemory((prev) => ({ ...prev, mode: newMode, lastDistrict: null, lastCrop: null }))
      const greeting = resolveFormLang(lastLanguage) === 'Tamil' ? DEFAULT_GREETING_TAMIL : DEFAULT_GREETING
      setMessages((prev) => [{ role: 'bot', content: greeting }])
    }
  }

  // ---- District selection ----
  const selectDistrict = async (districtValue) => {
    if (!districtValue) {
      await send(null, 'normal', 'SELECT_DISTRICT')
      return
    }
    const canonical = typeof districtValue === 'string' ? districtValue : districtValue.value
    setDistrict(canonical)
    setSessionMemory((prev) => ({ ...prev, lastDistrict: canonical, mode: 'normal', district: canonical }))
  }

  // ---- Crop selection ----
  const selectCrop = async (cropValue) => {
    const canonical = typeof cropValue === 'string' ? cropValue : cropValue.value
    setCrop(canonical)
    setSessionMemory((prev) => ({ ...prev, lastCrop: canonical, mode: 'normal', crop: canonical }))
    await send(`Crop ${canonical}`, 'normal')
  }

  // ---- Predict from raw-data context ----
  const submitPredictionForm = async () => {
    const check = validatePredictionForm(form, lastLanguage)
    setFormErrors(check.errors)
    setFormSubmitted(true)
    if (!check.complete) return false
    await send(buildPredictionMessage(form), 'prediction')
    return true
  }

  const updateFormField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      setFormErrors(validatePredictionForm(next, lastLanguage).errors)
      return next
    })
  }

  const resetPredictionForm = async () => {
    setForm(emptyPredictionForm())
    setFormErrors({})
    setFormSubmitted(false)
    await send('Start New Prediction', 'prediction')
  }

  const resetContext = async () => {
    setDistrict(null)
    setCrop(null)
    setSessionMemory((prev) => ({ ...prev, lastDistrict: null, lastCrop: null, predictionSession: null }))
    setMode('normal')
    const greeting = resolveFormLang(lastLanguage) === 'Tamil' ? DEFAULT_GREETING_TAMIL : DEFAULT_GREETING
    setMessages((prev) => [{ role: 'bot', content: greeting }])
  }

  const value = {
    mode, lastLanguage, sessionMemory, messages, input, loading,
    isListening, speakingIndex, voiceNotice, speechLang,
    district, crop,
    form, formErrors, formSubmitted, formValidation: validatePredictionForm(form, lastLanguage),
    meta, metaError,
    contextualActions,
    suggestions: mode === 'prediction' ? [] : contextualActions,
    districtOptions: getDistrictOptions(lastLanguage),
    cropOptions: getCropOptions(lastLanguage),
    setInput, handleLanguageChange, selectMode, send,
    selectDistrict, selectCrop,
    updateFormField, resetPredictionForm, submitPredictionForm,
    setFormSubmitted,
    speakMessage, toggleListening,
    resetContext
  }

  return <ChatbotContext.Provider value={value}>{children}</ChatbotContext.Provider>
}

export function useChatbot() {
  const ctx = useContext(ChatbotContext)
  if (!ctx) throw new Error('useChatbot must be used inside a ChatbotProvider')
  return ctx
}
