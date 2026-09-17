import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { MessageSquare, Send, X, Bot, User, Mic, MicOff, Globe } from 'lucide-react'

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: 'Hello! I am your Smart Coop & Soil Advisory Assistant. Ask me about fertilizers, schemes, announcements, or agricultural soil suitability across Tamil Nadu!'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechLang, setSpeechLang] = useState('en-IN') // 'en-IN' or 'ta-IN'
  const [voiceNotice, setVoiceNotice] = useState('')
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)

  const suggestions = [
    { label: '🌾 Salem Crops', question: 'What crop is suitable in Salem?' },
    { label: '🌱 Groundnut Soil', question: 'Is groundnut suitable for Salem?' },
    { label: '💧 Rice Water Req', question: 'What is the water requirement for rice in Thanjavur?' },
    { label: '📦 Urea Stock', question: 'Is urea available?' },
    { label: '📋 Eligible Schemes', question: 'Which government schemes am I eligible for?' },
    { label: 'தமிழ் பயிர்', question: 'சேலத்தில் எந்த பயிர் ஏற்றது?' }
  ]

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, loading, isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = speechLang

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceNotice('Listening... Speak into your microphone')
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
          setInput(prev => {
            // If previous input ended with something, append or replace
            return transcript
          })
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        if (event.error === 'not-allowed') {
          setVoiceNotice('Microphone access denied. Please allow microphone permissions in your browser.')
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
  }, [speechLang])

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

  const handleSend = async (messageText) => {
    const textToSend = messageText || input
    if (!textToSend.trim()) return

    const userMessage = { role: 'user', content: textToSend }
    setMessages(prev => [...prev, userMessage])
    if (!messageText) setInput('')
    setLoading(true)

    try {
      const response = await axios.post('/api/chatbot', { message: textToSend })
      setMessages(prev => [...prev, { role: 'bot', content: response.data.response }])
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I encountered an issue. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-primary-600 text-white p-4.5 rounded-full shadow-xl hover:bg-primary-700 hover:scale-105 transition-all z-50 flex items-center justify-center border border-primary-500/20"
          title="Open AI & Soil Assistant"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 sm:w-[420px] h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-primary-600 text-white p-4 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              <div>
                <h3 className="font-extrabold text-sm leading-none">Smart Coop & Soil AI</h3>
                <span className="text-[10px] text-primary-100 font-medium">Agricultural Soil & Cooperative Help</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Language Selector for Voice */}
              <div className="flex items-center bg-primary-700/80 rounded-lg px-2 py-0.5 text-[11px] font-bold">
                <Globe className="w-3 h-3 mr-1 text-primary-200" />
                <select
                  value={speechLang}
                  onChange={(e) => setSpeechLang(e.target.value)}
                  className="bg-transparent text-white outline-none cursor-pointer text-[10px]"
                  title="Select Speech Recognition Language"
                >
                  <option value="en-IN" className="text-gray-900">EN (India)</option>
                  <option value="ta-IN" className="text-gray-900">தமிழ் (Tamil)</option>
                </select>
              </div>

              <button onClick={() => setIsOpen(false)} className="hover:bg-primary-700 p-1 rounded-lg text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Voice Notification Banner */}
          {voiceNotice && (
            <div className="bg-amber-500 text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-between animate-pulse">
              <span className="flex items-center">
                <Mic className="w-3.5 h-3.5 mr-1.5" />
                {voiceNotice}
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user'
              return (
                <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start space-x-2 max-w-[88%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`p-1 rounded-lg border shrink-0 text-[10px] ${
                      isUser ? 'bg-primary-50 border-primary-100 text-primary-600' : 'bg-white border-gray-200 text-gray-400'
                    }`}>
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-primary-600" />}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      isUser 
                        ? 'bg-primary-600 text-white rounded-tr-none shadow-xs' 
                        : 'bg-white text-gray-800 border border-gray-150 rounded-tl-none shadow-sm'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="p-1 rounded-lg border bg-white text-gray-400">
                    <Bot className="w-3.5 h-3.5 text-primary-600 animate-spin" />
                  </div>
                  <div className="bg-white border border-gray-150 p-3 rounded-2xl rounded-tl-none shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions */}
          <div className="p-2.5 bg-white border-t border-gray-100 space-y-1.5 shrink-0">
            <span className="text-[9px] text-gray-400 uppercase tracking-wider font-extrabold block px-0.5">Quick Questions</span>
            <div className="grid grid-cols-3 gap-1.5">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(sug.question)}
                  disabled={loading}
                  className="p-1.5 bg-gray-50 border border-gray-200 hover:bg-primary-50 hover:border-primary-200 rounded-lg text-left text-[10px] font-bold text-gray-700 hover:text-primary-700 transition-all truncate"
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs & Microphone */}
          <div className="p-3 bg-white border-t border-gray-100 flex items-center space-x-2 shrink-0">
            {/* Mic button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl transition-all border ${
                isListening 
                  ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-md' 
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-primary-50 hover:text-primary-600'
              }`}
              title={isListening ? 'Stop Listening' : `Voice Input (${speechLang === 'ta-IN' ? 'தமிழ்' : 'English'})`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Listening... (Speaking in Tamil / English)" : "Ask about soil, crops, schemes, fertilizer..."}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-xs"
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-primary-600 text-white p-2.5 rounded-xl hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default Chatbot
