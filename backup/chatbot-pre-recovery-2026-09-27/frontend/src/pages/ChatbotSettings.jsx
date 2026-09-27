import { useState, useRef } from 'react'
import { useChatbot } from '../context/ChatbotContext'
import { MessageSquare, Send, Sparkles, User, Bot, Globe, Mic, MicOff, Volume2, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

const ChatbotSettings = () => {
  const [isOpen, setIsOpen] = useState(true)
  const {
    lastLanguage, handleLanguageChange,
    messages, input, loading,
    isListening, speakingIndex, voiceNotice,
    suggestions,
    form, formErrors, formSubmitted, formValidation,
    meta, metaError,
    setInput,
    selectMode, send, selectDistrict, selectCrop,
    updateFormField, resetPredictionForm, submitPredictionForm,
    speakMessage, toggleListening, resetContext,
    mode, district, crop
  } = useChatbot()

  const messagesEndRef = useRef(null)

  const handleSend = (messageText) => {
    send(messageText)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const actionBtnHandler = (sug) => {
    const action = sug.action
    if (action === 'SELECT_DISTRICT') {
      selectDistrict(null)
    } else {
      send(sug.message || null, 'normal', action)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="page-header flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Bot className="w-6 h-6 mr-2 text-primary-600" />
            Smart Coop Voice & Multilingual Assistant
          </h1>
          <p className="text-sm text-gray-500 mt-1">Ask questions in English or Tamil about crop and district information from our verified dataset.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-primary-50 border border-primary-200 text-primary-800 px-3 py-1.5 rounded-xl text-xs font-bold">
            <Globe className="w-4 h-4 mr-1.5 text-primary-600" />
            <select
              value={lastLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-transparent text-primary-900 outline-none cursor-pointer font-extrabold text-xs"
              title="Select Chatbot Language"
            >
              <option value="English">English</option>
              <option value="Tamil">தமிழ் (Tamil)</option>
            </select>
          </div>
          <div className="flex items-center space-x-1 bg-yellow-50 border border-yellow-100 text-yellow-750 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-yellow-500 animate-pulse" />
            Voice + Soil Active
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[600px] overflow-hidden">
          {voiceNotice && (
            <div className="bg-amber-500 text-white text-xs font-bold px-4 py-2 flex items-center justify-between animate-pulse shrink-0">
              <span className="flex items-center">
                <Mic className="w-4 h-4 mr-2" />
                {voiceNotice}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user'
              const isSpeaking = speakingIndex === index
              const hasSoilResult = Boolean(msg.soilResult && msg.soilResult.factors)

              return (
                <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`flex items-start space-x-2.5 max-w-[85%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`p-2 rounded-xl border shrink-0 ${
                      isUser ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-200 text-gray-700'
                    }`}>
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary-600" />}
                    </div>
                    <div className="relative group flex items-end space-x-2">
                      <div className={`p-4 rounded-2xl leading-relaxed text-sm ${
                        isUser
                          ? 'bg-primary-600 text-white rounded-tr-none font-medium shadow-xs'
                          : 'bg-white text-gray-800 border border-gray-150 rounded-tl-none shadow-sm'
                      }`}>
                        {!hasSoilResult ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                              <div>
                                <h4 className="font-extrabold text-gray-900 text-sm">Soil & Crop Suitability</h4>
                                <p className="text-xs text-gray-600 font-medium">
                                  {msg.soilResult.crop} • {msg.soilResult.district || 'Salem'}
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                                msg.soilResult.prediction === 'Suitable' ? 'bg-emerald-100 text-emerald-800' :
                                msg.soilResult.prediction === 'Needs Improvement' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {msg.soilResult.prediction === 'Suitable' ? (lastLanguage === 'Tamil' ? 'ஏற்றது' : 'Suitable') :
                                 msg.soilResult.prediction === 'Needs Improvement' ? (lastLanguage === 'Tamil' ? 'மேம்படுத்த வேண்டும்' : 'Needs Improvement') :
                                 (lastLanguage === 'Tamil' ? 'ஏற்றதல்ல' : 'Not Suitable')}
                              </span>
                            </div>
                            <div className="space-y-1.5 text-xs pt-1">
                              {Object.entries(msg.soilResult.factors).map(([key, f]) => {
                                const isGood = f.status === 'Suitable'
                                const isMod = f.status === 'Moderate'
                                const keyLabel = key.charAt(0).toUpperCase() + key.slice(1)
                                return (
                                  <div key={key} className="flex items-center justify-between py-1 border-b border-gray-50">
                                    <span className="text-gray-600 font-medium flex items-center">
                                      {isGood ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-2" /> :
                                       isMod ? <Info className="w-3.5 h-3.5 text-amber-500 mr-2" /> :
                                       <AlertTriangle className="w-3.5 h-3.5 text-rose-500 mr-2" />}
                                      {keyLabel}
                                    </span>
                                    <span className={`font-bold ${
                                      isGood ? 'text-emerald-700' : isMod ? 'text-amber-700' : 'text-rose-700'
                                    }`}>
                                      {f.status}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                            {msg.soilResult.suggestions && msg.soilResult.suggestions.length > 0 && (
                              <div className="border-t border-gray-150 pt-2.5 text-xs text-gray-700 space-y-1">
                                <p className="font-bold text-gray-800">What you can do:</p>
                                {msg.soilResult.suggestions.map((sug, sIdx) => (
                                  <p key={sIdx} className="leading-relaxed">• {sug.replace(/^•\s*/, '')}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => speakMessage(msg, index)}
                          className={`p-2 rounded-full transition-all shrink-0 ${
                            isSpeaking
                              ? 'bg-primary-600 text-white animate-pulse shadow-md'
                              : 'text-gray-400 hover:text-primary-600 hover:bg-white border border-gray-200 shadow-2xs'
                          }`}
                          title={isSpeaking ? 'Stop speaking' : `Read response aloud (${lastLanguage})`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2.5 max-w-[80%]">
                  <div className="p-2 rounded-xl border bg-white border-gray-200 text-gray-700">
                    <Bot className="w-4 h-4 text-primary-600 animate-spin" />
                  </div>
                  <div className="bg-white border border-gray-150 p-4 rounded-2xl rounded-tl-none shadow-sm">
                    <div className="flex space-x-1.5 py-1">
                      <div className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce"></div>
                      <div className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-gray-100 space-y-2 shrink-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold px-1">Quick Actions</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => actionBtnHandler(sug)}
                  disabled={loading}
                  className="p-2.5 bg-gray-50 border border-gray-200 hover:bg-primary-50 hover:border-primary-300 rounded-xl text-left text-xs font-bold text-gray-700 hover:text-primary-700 transition-all shadow-sm shrink-0 truncate"
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex items-center space-x-3 shrink-0">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-xl transition-all border ${
                isListening
                  ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-md'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-primary-50 hover:text-primary-600'
              }`}
              title={isListening ? 'Stop Listening' : `Voice Input (${lastLanguage === 'Tamil' ? 'தமிழ்' : 'English'})`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? `Listening... (${lastLanguage === 'Tamil' ? 'தமிழ்' : 'English'})` : `Ask in ${lastLanguage}...`}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm transition-all bg-gray-50/50"
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-primary-600 text-white p-3 rounded-xl hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatbotSettings
