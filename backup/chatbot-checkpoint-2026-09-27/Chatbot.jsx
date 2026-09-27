import { useState, useRef } from 'react'
import { useChatbot } from '../context/ChatbotContext'
import { MessageSquare, Send, X, Bot, User, Mic, MicOff, Globe, Volume2, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const {
    lastLanguage, handleLanguageChange,
    messages, input, loading,
    isListening, speakingIndex, voiceNotice,
    suggestions,
    districtOptions,
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
          <div className="bg-primary-600 text-white p-4 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              <div>
                <h3 className="font-extrabold text-sm leading-none">Smart Coop & Soil AI</h3>
                <span className="text-[10px] text-primary-100 font-medium">Agricultural Soil & Cooperative Help</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-primary-700/90 rounded-lg px-2 py-1 text-[11px] font-bold border border-primary-500/30">
                <Globe className="w-3.5 h-3.5 mr-1 text-primary-200" />
                <select
                  value={lastLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-transparent text-white outline-none cursor-pointer text-xs font-bold"
                  title="Select Chatbot Language"
                >
                  <option value="English" className="text-gray-900 font-medium">English</option>
                  <option value="Tamil" className="text-gray-900 font-medium">தமிழ்</option>
                </select>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-primary-700 p-1 rounded-lg text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {voiceNotice && (
            <div className="bg-amber-500 text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-between animate-pulse">
              <span className="flex items-center">
                <Mic className="w-3.5 h-3.5 mr-1.5" />
                {voiceNotice}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user'
              const isSpeaking = speakingIndex === index
              const hasSoilResult = Boolean(msg.soilResult && msg.soilResult.factors)

              return (
                <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start space-x-2 max-w-[88%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`p-1 rounded-lg border shrink-0 text-[10px] ${
                      isUser ? 'bg-primary-50 border-primary-100 text-primary-600' : 'bg-white border-gray-200 text-gray-400'
                    }`}>
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-primary-600" />}
                    </div>
                    <div className="relative group flex items-end space-x-1">
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-primary-600 text-white rounded-tr-none shadow-xs'
                          : 'bg-white text-gray-800 border border-gray-150 rounded-tl-none shadow-sm'
                      }`}>
                        {!hasSoilResult ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                              <div>
                                <h4 className="font-extrabold text-gray-900 text-xs">Soil & Crop Suitability</h4>
                                <p className="text-[11px] text-gray-600 font-medium">
                                  {msg.soilResult.crop} • {msg.soilResult.district || 'Salem'}
                                </p>
                              </div>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                                msg.soilResult.prediction === 'Suitable' ? 'bg-emerald-100 text-emerald-800' :
                                msg.soilResult.prediction === 'Needs Improvement' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {msg.soilResult.prediction === 'Suitable' ? (lastLanguage === 'Tamil' ? 'ஏற்றது' : 'Suitable') :
                                 msg.soilResult.prediction === 'Needs Improvement' ? (lastLanguage === 'Tamil' ? 'மேம்படுத்த வேண்டும்' : 'Needs Improvement') :
                                 (lastLanguage === 'Tamil' ? 'ஏற்றதல்ல' : 'Not Suitable')}
                              </span>
                            </div>
                            <div className="space-y-1 text-[11px] pt-1">
                              {Object.entries(msg.soilResult.factors).map(([key, f]) => {
                                const isGood = f.status === 'Suitable'
                                const isMod = f.status === 'Moderate'
                                const keyLabel = key.charAt(0).toUpperCase() + key.slice(1)
                                return (
                                  <div key={key} className="flex items-center justify-between py-0.5">
                                    <span className="text-gray-600 font-medium flex items-center">
                                      {isGood ? <CheckCircle2 className="w-3 h-3 text-emerald-500 mr-1.5" /> :
                                       isMod ? <Info className="w-3 h-3 text-amber-500 mr-1.5" /> :
                                       <AlertTriangle className="w-3 h-3 text-rose-500 mr-1.5" />}
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
                              <div className="border-t border-gray-150 pt-2 text-[11px] text-gray-700 space-y-1">
                                <p className="font-bold text-gray-800">What you can do:</p>
                                {msg.soilResult.suggestions.map((sug, sIdx) => (
                                  <p key={sIdx} className="leading-snug">• {sug.replace(/^•\s*/, '')}</p>
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
                          className={`p-1.5 rounded-full transition-all shrink-0 ${
                            isSpeaking
                              ? 'bg-primary-600 text-white animate-pulse shadow-sm'
                              : 'text-gray-400 hover:text-primary-600 hover:bg-white border border-transparent hover:border-gray-200'
                          }`}
                          title={isSpeaking ? 'Stop speaking' : `Read answer (${lastLanguage === 'Tamil' ? 'தமிழ்' : 'English'})`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {!district && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="p-1 rounded-lg border bg-white text-gray-400">
                    <Bot className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <div className="bg-white border border-gray-150 p-3 rounded-2xl rounded-tl-none shadow-sm space-y-2">
                    <p className="text-xs text-gray-700 font-medium">
                      {lastLanguage === 'Tamil' ? 'மாவட்டத்தைத் தேர்ந்தெடுக்கவும்:' : 'Select a district:'}
                    </p>
                    {districtOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => selectDistrict(opt)}
                        disabled={loading}
                        className="block w-full text-left px-3 py-1.5 bg-gray-50 border border-gray-200 hover:bg-primary-50 hover:border-primary-200 rounded-lg text-xs font-bold text-gray-700 hover:text-primary-700 transition-all"
                      >
                        {opt.display}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
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

          <div className="p-2.5 bg-white border-t border-gray-100 space-y-1.5 shrink-0">
            <span className="text-[9px] text-gray-400 uppercase tracking-wider font-extrabold block px-0.5">Quick Actions</span>
            <div className="grid grid-cols-2 gap-1.5">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => actionBtnHandler(sug)}
                  disabled={loading}
                  className="p-1.5 bg-gray-50 border border-gray-200 hover:bg-primary-50 hover:border-primary-200 rounded-lg text-left text-[10px] font-bold text-gray-700 hover:text-primary-700 transition-all truncate"
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-white border-t border-gray-100 flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl transition-all border ${
                isListening
                  ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-md'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-primary-50 hover:text-primary-600'
              }`}
              title={isListening ? 'Stop Listening' : `Voice Input (${lastLanguage === 'Tamil' ? 'தமிழ் (ta-IN)' : 'English (en-IN)'})`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? `Listening... (${lastLanguage === 'Tamil' ? 'தமிழ்' : 'English'})` : `Ask in ${lastLanguage}...`}
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
