import { useEffect, useRef } from 'react'
import { Send, Bot, User, Mic, MicOff, Globe, Volume2, X } from 'lucide-react'
import { useChatbot } from '../context/ChatbotContext'
import PredictionForm from './PredictionForm'

const ChatPanel = ({ variant = 'page', onClose }) => {
  const compact = variant === 'float'
  const {
    lastLanguage, handleLanguageChange,
    messages, input, loading,
    isListening, speakingIndex, voiceNotice,
    suggestions,
    districtOptions, cropOptions,
    setInput, send, selectDistrict, selectCrop, selectMode,
    speakMessage, toggleListening, resetContext,
    mode, awaitingDistrict, awaitingCrop, strings
  } = useChatbot()

  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, awaitingDistrict, awaitingCrop])

  const handleSend = () => send()
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const actionBtnHandler = (sug) => {
    if (sug.action === 'SELECT_DISTRICT') {
      selectDistrict(null)
    } else if (sug.action === 'RESET_CONVERSATION') {
      resetContext()
    } else {
      send(sug.message || '', 'normal', sug.action)
    }
  }

  return (
    <div className={`bg-white flex flex-col overflow-hidden ${compact ? 'h-full' : 'h-full'}`}>
      <div className={`bg-primary-600 text-white flex items-center justify-between shrink-0 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center min-w-0">
          <Bot className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} mr-2 shrink-0`} />
          <div className="min-w-0">
            <h3 className={`font-extrabold leading-none ${compact ? 'text-sm' : 'text-base'}`}>{strings.title}</h3>
            <span className="text-[10px] text-primary-100 font-medium">{strings.subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex bg-primary-800/60 rounded-lg p-0.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => { if (mode !== 'normal') selectMode('normal') }}
              className={`px-2 py-1 rounded-md ${mode === 'normal' ? 'bg-white text-primary-800' : 'text-primary-100'}`}
            >
              {strings.modeData}
            </button>
            <button
              type="button"
              onClick={() => { if (mode !== 'prediction') selectMode('prediction') }}
              className={`px-2 py-1 rounded-md ${mode === 'prediction' ? 'bg-white text-primary-800' : 'text-primary-100'}`}
            >
              {strings.modePredict}
            </button>
          </div>
          <div className="flex items-center bg-primary-700/90 rounded-lg px-2 py-1 text-[11px] font-bold">
            <Globe className="w-3.5 h-3.5 mr-1 text-primary-200" />
            <select
              value={lastLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-transparent text-white outline-none cursor-pointer text-xs font-bold"
            >
              <option value="English" className="text-gray-900">English</option>
              <option value="Tamil" className="text-gray-900">தமிழ்</option>
            </select>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-primary-700">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {voiceNotice && (
        <div className="bg-amber-500 text-white text-[11px] font-bold px-3 py-1.5">
          {voiceNotice}
        </div>
      )}

      <div className={`flex-1 overflow-y-auto space-y-3 bg-gray-50/50 ${compact ? 'p-3' : 'p-5'}`}>
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user'
          const isSpeaking = speakingIndex === index
          return (
            <div key={`${index}-${msg.role}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start space-x-2 max-w-[90%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`p-1 rounded-lg border shrink-0 ${isUser ? 'bg-primary-50 border-primary-100 text-primary-600' : 'bg-white border-gray-200 text-gray-400'}`}>
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-primary-600" />}
                </div>
                <div className="relative flex items-end space-x-1">
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-primary-600 text-white rounded-tr-none'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => speakMessage(msg, index)}
                      className={`p-1.5 rounded-full shrink-0 ${isSpeaking ? 'bg-primary-600 text-white animate-pulse' : 'text-gray-400 hover:text-primary-600'}`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {mode === 'normal' && awaitingDistrict && (
          <div className="bg-white border border-gray-200 rounded-xl p-3 max-w-[90%]">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">{strings.selectDistrict}</label>
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) selectDistrict(e.target.value) }}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            >
              <option value="">{strings.selectDistrict}</option>
              {districtOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.display}</option>
              ))}
            </select>
          </div>
        )}

        {mode === 'normal' && awaitingCrop && (
          <div className="bg-white border border-gray-200 rounded-xl p-3 max-w-[90%]">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">{strings.askCrop}</label>
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) selectCrop(e.target.value) }}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            >
              <option value="">{strings.askCrop}</option>
              {cropOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.display}</option>
              ))}
            </select>
          </div>
        )}

        {mode === 'prediction' && <PredictionForm compact={compact} />}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {mode === 'normal' && (
        <div className={`bg-white border-t border-gray-100 shrink-0 ${compact ? 'p-2' : 'p-3'}`}>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((sug) => (
              <button
                key={sug.action}
                type="button"
                onClick={() => actionBtnHandler(sug)}
                disabled={loading}
                className="px-2.5 py-1 bg-gray-50 border border-gray-200 hover:bg-primary-50 rounded-full text-[11px] font-bold text-gray-700 hover:text-primary-700 disabled:opacity-50"
              >
                {sug.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`bg-white border-t border-gray-100 flex items-center space-x-2 shrink-0 ${compact ? 'p-2.5' : 'p-3'}`}>
        <button
          type="button"
          onClick={toggleListening}
          className={`p-2.5 rounded-xl border ${isListening ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isListening ? strings.listening : strings.placeholder}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs"
          disabled={loading}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-primary-600 text-white p-2.5 rounded-xl disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default ChatPanel
