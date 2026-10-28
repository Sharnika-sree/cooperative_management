import { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
  sendChatMessage,
  fetchSoilMeta,
  cleanTtsText,
  emptyPredictionForm,
  validatePredictionForm,
  buildPredictionMessage,
  parseTranscriptToForm,
  getDistrictOptions,
  getCropOptions,
  resolveFormLang,
  rawDataStrings,
  getContextualActions,
  RAW_ACTIONS,
  detectRawAction,
  matchDistrictValue,
  matchCropValue,
  displayDistrictName,
  displayCropName
} from '../services/chatbotService'

const ChatbotContext = createContext(null)

export function ChatbotProvider({ children }) {
  const [mode, setMode] = useState('normal')
  const [lastLanguage, setLastLanguage] = useState('English')
  const [sessionMemory, setSessionMemory] = useState({
    lastLanguage: 'English',
    lastDistrict: null,
    lastCrop: null,
    district: null,
    crop: null,
    predictionSession: null,
    mode: 'normal'
  })

  const S0 = rawDataStrings('English')
  const [messages, setMessages] = useState([{ role: 'bot', content: S0.greeting, ttsText: S0.greeting }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speakingIndex, setSpeakingIndex] = useState(null)
  const [voiceNotice, setVoiceNotice] = useState('')
  const [district, setDistrict] = useState(null)
  const [crop, setCrop] = useState(null)
  const [awaitingDistrict, setAwaitingDistrict] = useState(false)
  const [awaitingCrop, setAwaitingCrop] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [form, setForm] = useState(emptyPredictionForm())
  const [formErrors, setFormErrors] = useState({})
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [meta, setMeta] = useState({ districts: [], crops: [] })
  const [metaError, setMetaError] = useState('')
  const recognitionRef = useRef(null)
  const lastSendRef = useRef('')
  const wasVoiceInputRef = useRef(false)
  const [availableVoices, setAvailableVoices] = useState([])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const loadVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices()
        if (v && v.length > 0) {
          setAvailableVoices(v)
        }
      } catch (e) {
        console.warn('Voice loading error:', e)
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  const speechLang = lastLanguage === 'Tamil' ? 'ta-IN' : 'en-IN'
  const strings = rawDataStrings(lastLanguage)

  useEffect(() => {
    fetchSoilMeta().then(setMeta).catch(() => setMetaError('meta'))
  }, [])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
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
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
        else interimTranscript += event.results[i][0].transcript
      }
      const transcript = finalTranscript || interimTranscript
      if (transcript) {
        wasVoiceInputRef.current = true
        setInput(transcript)
        setMode((currentMode) => {
          if (currentMode === 'prediction') {
            setForm((prev) => parseTranscriptToForm(transcript, prev))
          }
          return currentMode
        })
      }
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      const S = rawDataStrings(lastLanguage)
      if (event.error === 'not-allowed') setVoiceNotice(S.micDenied)
      else if (event.error === 'no-speech') setVoiceNotice(S.noSpeech)
      else setVoiceNotice(S.voiceError)
      setTimeout(() => setVoiceNotice(''), 4000)
    }
    recognition.onend = () => {
      setIsListening(false)
      setVoiceNotice('')
    }
    recognitionRef.current = recognition
  }, [speechLang, lastLanguage])

  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const S = rawDataStrings(lastLanguage)
    if (!SpeechRecognition) {
      alert(S.voiceUnsupported)
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
        setVoiceNotice(S.voiceError)
      }
    }
  }

  const speakMessage = (msg, index) => {
    const S = rawDataStrings(lastLanguage)
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert(S.ttsUnsupported)
      return
    }

    window.speechSynthesis.cancel()

    if (speakingIndex === index) {
      setSpeakingIndex(null)
      return
    }

    // Always use the rendered answer text inside the chatbot response text box
    const textToSpeak = cleanTtsText(msg.content || msg.ttsText || '')
    if (!textToSpeak) return

    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices()
    const utterance = new SpeechSynthesisUtterance(textToSpeak)

    if (lastLanguage === 'Tamil') {
      // Find a Tamil-compatible voice (ta-IN, ta, Tamil, Valluvar)
      const tamilVoice = voices.find((v) => {
        const lang = (v.lang || '').toLowerCase().replace('_', '-')
        const name = (v.name || '').toLowerCase()
        return lang === 'ta-in' || lang === 'ta' || lang.startsWith('ta-') || name.includes('tamil') || name.includes('valluvar')
      })

      if (tamilVoice) {
        utterance.voice = tamilVoice
        utterance.lang = tamilVoice.lang || 'ta-IN'
      } else {
        // Required Tamil voice is unavailable in the browser / OS
        // Explicitly block English voice fallback to prevent reading numbers only
        setSpeakingIndex(null)
        setVoiceNotice('தமிழ் குரல் உலாவியில் கிடைக்கவில்லை. முழுமையான தமிழ் குரல் கேட்க Windows Settings > Time & Language > Speech இல் Tamil (India) குரலை நிறுவவும்.')
        setTimeout(() => setVoiceNotice(''), 6000)
        return
      }
    } else {
      // English voice selection strategy
      const enVoice = voices.find((v) => {
        const lang = (v.lang || '').toLowerCase().replace('_', '-')
        return lang === 'en-in' || lang === 'en-us' || lang.startsWith('en')
      })
      if (enVoice) {
        utterance.voice = enVoice
        utterance.lang = enVoice.lang || 'en-IN'
      } else {
        utterance.lang = 'en-US'
      }
    }

    utterance.rate = 0.95
    utterance.pitch = 1.0

    utterance.onstart = () => setSpeakingIndex(index)
    utterance.onend = () => setSpeakingIndex(null)
    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e)
      setSpeakingIndex(null)
    }

    window.speechSynthesis.speak(utterance)
  }

  const applyMemory = (mem) => {
    if (!mem) return
    setSessionMemory(mem)
    if (mem.mode === 'prediction' || mem.mode === 'normal') setMode(mem.mode)
    if (mem.district) setDistrict(mem.district)
    else if (mem.district === null) setDistrict(null)
    else if (mem.lastDistrict) setDistrict(mem.lastDistrict)
    if (mem.crop) setCrop(mem.crop)
    else if (mem.crop === null) setCrop(null)
    else if (mem.lastCrop) setCrop(mem.lastCrop)
    if (mem.needCrop || mem.pendingAction) {
      setAwaitingCrop(true)
      setPendingAction(mem.pendingAction || pendingAction)
    }
  }

  const send = async (messageText, forceMode, action, options = {}) => {
    const textToSend = messageText == null ? input : messageText
    const activeMode = forceMode || mode
    let resolvedAction = action
    let payloadText = textToSend

    if (!resolvedAction && payloadText && activeMode !== 'prediction') {
      const asAction = detectRawAction(payloadText, lastLanguage)
      if (asAction) {
        resolvedAction = asAction
      } else {
        const d = matchDistrictValue(payloadText)
        if (d) {
          resolvedAction = 'SET_DISTRICT'
          payloadText = d
        } else if (awaitingCrop || pendingAction) {
          const c = matchCropValue(payloadText)
          if (c) {
            resolvedAction = 'SET_CROP'
            payloadText = c
          }
        }
      }
    }

    if (resolvedAction === 'RESET_CONVERSATION') {
      resetContext()
      return
    }

    const isStructured = resolvedAction && RAW_ACTIONS.has(resolvedAction)
    if (!isStructured && !(payloadText && String(payloadText).trim()) && activeMode !== 'prediction') return

    const dedupeKey = `${resolvedAction || ''}|${String(payloadText || '').trim()}|${activeMode}`
    if (lastSendRef.current === dedupeKey && loading) return
    lastSendRef.current = dedupeKey

    const silent = options.silentUser || resolvedAction === 'SELECT_DISTRICT' || resolvedAction === 'SELECT_CROP'
    if (!silent && payloadText && String(payloadText).trim()) {
      const shown = resolvedAction === 'SET_DISTRICT'
        ? displayDistrictName(payloadText, lastLanguage)
        : resolvedAction === 'SET_CROP'
          ? displayCropName(payloadText, lastLanguage)
          : payloadText
      setMessages((prev) => [...prev, { role: 'user', content: shown }])
    }
    if (!options.keepInput && !messageText && !isStructured) setInput('')
    else if (!options.keepInput && messageText && !isStructured) setInput('')
    setLoading(true)

    try {
      const data = await sendChatMessage({
        message: isStructured && (resolvedAction === 'SELECT_DISTRICT' || resolvedAction === 'SELECT_CROP')
          ? ''
          : (payloadText || ''),
        language: lastLanguage,
        mode: activeMode,
        sessionMemory: {
          ...sessionMemory,
          lastLanguage,
          mode: activeMode,
          district,
          crop,
          lastDistrict: district,
          lastCrop: crop,
          pendingAction,
          ...(options.memory || {})
        },
        action: isStructured ? resolvedAction : undefined
      })

      const botMsg = {
        role: 'bot',
        content: data.response,
        ttsText: data.ttsText,
        soilResult: data.soilResult
      }
      setMessages((prev) => {
        const next = [...prev, botMsg]
        if (wasVoiceInputRef.current) {
          wasVoiceInputRef.current = false
          setTimeout(() => speakMessage(botMsg, next.length - 1), 100)
        }
        return next
      })

      if (data.needCrop) {
        setAwaitingCrop(true)
        setPendingAction(data.pendingAction || resolvedAction || pendingAction)
      } else if (resolvedAction === 'SET_CROP') {
        setAwaitingCrop(false)
      }
      if (resolvedAction === 'SELECT_DISTRICT') setAwaitingDistrict(true)
      if (resolvedAction === 'SET_DISTRICT') setAwaitingDistrict(false)

      applyMemory({ ...data.sessionMemory, needCrop: data.needCrop, pendingAction: data.pendingAction })

      if (resolvedAction === 'SET_CROP' && (data.sessionMemory?.pendingAction || pendingAction) && !data.needCrop) {
        const follow = data.sessionMemory?.pendingAction || pendingAction
        if (follow && follow !== 'SET_CROP' && follow !== 'SELECT_CROP') {
          setPendingAction(null)
          setLoading(false)
          await send('', 'normal', follow, { silentUser: true })
          return
        }
      }
    } catch (error) {
      console.error(error)
      const errReply = lastLanguage === 'Tamil'
        ? 'சேவை தற்காலிகமாக கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.'
        : 'The assistant is temporarily unavailable. Please try again.'
      setMessages((prev) => [...prev, { role: 'bot', content: errReply, ttsText: errReply }])
    } finally {
      setLoading(false)
      lastSendRef.current = ''
    }
  }

  const selectMode = async (newMode) => {
    setMode(newMode)
    if (newMode === 'prediction') {
      setForm(emptyPredictionForm())
      setFormErrors({})
      setFormSubmitted(false)
      setDistrict(null)
      setCrop(null)
      setAwaitingDistrict(false)
      setAwaitingCrop(false)
      setPendingAction(null)
      setSessionMemory((prev) => ({
        ...prev,
        mode: newMode,
        predictionSession: null,
        district: null,
        crop: null,
        lastDistrict: null,
        lastCrop: null
      }))
      const intro = lastLanguage === 'Tamil'
        ? 'மண் கணிப்புக்கு கீழே உள்ள படிவத்தில் அனைத்து புலங்களையும் நிரப்பவும்.'
        : 'Fill every field in the form below to run a soil prediction.'
      setMessages((prev) => [...prev, { role: 'bot', content: intro, ttsText: intro }])
    } else {
      setDistrict(null)
      setCrop(null)
      setAwaitingDistrict(false)
      setAwaitingCrop(false)
      setPendingAction(null)
      setSessionMemory((prev) => ({ ...prev, mode: newMode, lastDistrict: null, lastCrop: null, district: null, crop: null }))
      const greeting = rawDataStrings(lastLanguage).greeting
      setMessages([{ role: 'bot', content: greeting, ttsText: greeting }])
    }
  }

  const handleLanguageChange = (newLang) => {
    if (newLang !== 'English' && newLang !== 'Tamil') return
    window.speechSynthesis?.cancel()
    setLastLanguage(newLang)
    setMode('normal')
    setDistrict(null)
    setCrop(null)
    setAwaitingDistrict(false)
    setAwaitingCrop(false)
    setPendingAction(null)
    setInput('')
    setForm(emptyPredictionForm())
    setFormErrors({})
    setFormSubmitted(false)
    const greeting = rawDataStrings(newLang).greeting
    setMessages([{ role: 'bot', content: greeting, ttsText: greeting }])
    setSessionMemory({
      lastLanguage: newLang,
      lastDistrict: null,
      lastCrop: null,
      district: null,
      crop: null,
      predictionSession: null,
      mode: 'normal'
    })
  }

  const selectDistrict = async (districtValue) => {
    if (!districtValue) {
      setDistrict(null)
      setCrop(null)
      setAwaitingDistrict(true)
      setAwaitingCrop(false)
      setPendingAction(null)
      setSessionMemory((prev) => ({
        ...prev,
        district: null,
        crop: null,
        lastDistrict: null,
        lastCrop: null,
        pendingAction: null
      }))
      await send('', 'normal', 'SELECT_DISTRICT', { silentUser: true })
      return
    }
    const canonical = typeof districtValue === 'string' ? districtValue : districtValue.value
    setCrop(null)
    setDistrict(canonical)
    setAwaitingDistrict(false)
    setSessionMemory((prev) => ({
      ...prev,
      lastDistrict: canonical,
      district: canonical,
      lastCrop: null,
      crop: null,
      mode: 'normal'
    }))
    await send(canonical, 'normal', 'SET_DISTRICT', {
      memory: { district: canonical, lastDistrict: canonical, crop: null, lastCrop: null }
    })
  }

  const selectCrop = async (cropValue) => {
    const canonical = typeof cropValue === 'string' ? cropValue : cropValue.value
    setCrop(canonical)
    setAwaitingCrop(false)
    setSessionMemory((prev) => ({ ...prev, lastCrop: canonical, crop: canonical, mode: 'normal' }))
    await send(canonical, 'normal', 'SET_CROP')
  }

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

  const resetPredictionForm = () => {
    setForm(emptyPredictionForm())
    setFormErrors({})
    setFormSubmitted(false)
    const intro = lastLanguage === 'Tamil'
      ? 'புதிய கணிப்பு. அனைத்து புலங்களையும் நிரப்பவும்.'
      : 'New prediction. Fill every field.'
    setMessages((prev) => [...prev, { role: 'bot', content: intro, ttsText: intro }])
  }

  const resetContext = () => {
    setDistrict(null)
    setCrop(null)
    setAwaitingDistrict(false)
    setAwaitingCrop(false)
    setPendingAction(null)
    setMode('normal')
    const greeting = rawDataStrings(lastLanguage).greeting
    setMessages([{ role: 'bot', content: greeting, ttsText: greeting }])
    setSessionMemory((prev) => ({
      ...prev,
      lastDistrict: null,
      lastCrop: null,
      district: null,
      crop: null,
      predictionSession: null,
      mode: 'normal'
    }))
  }

  const contextualActions = mode === 'prediction'
    ? []
    : getContextualActions({ district, crop }, lastLanguage)

  const value = {
    mode, lastLanguage, sessionMemory, messages, input, loading,
    isListening, speakingIndex, voiceNotice, speechLang,
    district, crop, awaitingDistrict, awaitingCrop,
    form, formErrors, formSubmitted, formValidation: validatePredictionForm(form, lastLanguage),
    meta, metaError,
    contextualActions,
    suggestions: contextualActions,
    districtOptions: getDistrictOptions(lastLanguage),
    cropOptions: getCropOptions(lastLanguage),
    strings,
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
